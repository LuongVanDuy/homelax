import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { blogAdminPostSchema, blogPostCardSchema, blogPublicPostSchema, type BlogListQuery, type BlogPostWrite, type BlogPostUpdate, type BlogCategoryWrite } from '@tinyhouse/contracts';
import { PostgresService } from '../../database/postgres.service.js';
import type { AppIdentity } from '../../common/auth/auth.types.js';

const fields = `p.id,p.title,p.slug,p.excerpt,p.cover_image AS "coverImage",p.content,p.status,p.revision,
  p.category_id AS "categoryId",p.published_at AS "publishedAt",p.updated_at AS "updatedAt",
  json_build_object('id',c.id,'name',c.name,'slug',c.slug) AS category`;
const from = 'FROM blog_posts p JOIN blog_categories c ON c.id=p.category_id';
function map(row: Record<string, any>) {
  return { ...row, publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null, updatedAt: new Date(row.updatedAt).toISOString() };
}

@Injectable()
export class BlogService {
  constructor(private readonly db: PostgresService) {}

  async categories(publicOnly = false) {
    const result = await this.db.query(`SELECT c.id,c.name,c.slug,count(p.id)::int AS "postCount"
      FROM blog_categories c LEFT JOIN blog_posts p ON p.category_id=c.id ${publicOnly ? "AND p.status='published'" : ''}
      GROUP BY c.id ORDER BY c.name,c.id`);
    return result.rows;
  }

  async list(query: BlogListQuery, publicOnly = false) {
    const result = await this.db.query(`WITH matched AS (SELECT ${fields} ${from}
      WHERE ($1='' OR c.slug=$1) AND ($2='' OR p.status=$2)
        AND ($3='' OR p.title ILIKE $4 OR p.excerpt ILIKE $4)),
      page AS (SELECT * FROM matched ORDER BY "publishedAt" DESC NULLS LAST,"updatedAt" DESC,id LIMIT $5 OFFSET $6)
      SELECT (SELECT count(*)::int FROM matched) AS total,COALESCE((SELECT json_agg(page) FROM page),'[]'::json) AS items`,
    [query.category,publicOnly ? 'published' : query.status,query.search,`%${query.search.replace(/[\\%_]/g,'\\$&')}%`,query.pageSize,(query.page-1)*query.pageSize]);
    const { total,items } = result.rows[0];
    return { items: items.map((row: Record<string, any>) => (publicOnly ? blogPostCardSchema : blogAdminPostSchema).parse(map(row))),
      pagination:{page:query.page,pageSize:query.pageSize,total,totalPages:Math.ceil(total/query.pageSize)} };
  }

  async detail(key: string, publicOnly = false) {
    const result = await this.db.query(`SELECT ${fields} ${from} WHERE ${publicOnly ? "p.slug=$1 AND p.status='published'" : 'p.id=$1'}`, [key]);
    if (!result.rows[0]) throw new NotFoundException({error:'Bài viết không tồn tại hoặc chưa được xuất bản.'});
    return (publicOnly ? blogPublicPostSchema : blogAdminPostSchema).parse(map(result.rows[0]));
  }

  private async write<T>(actor: AppIdentity, action: (client: PoolClient, audit: (entity:string,id:string,action:string) => Promise<void>) => Promise<T>) {
    try {
      return await this.db.transaction(async client => {
        await client.query('SELECT pg_advisory_xact_lock(74120,1)');
        const {rows:[user]} = await client.query('SELECT role_code,status,name,email FROM users WHERE id=$1',[actor.id]);
        if (!user || !['admin','superadmin'].includes(user.role_code) || !['hoạt động','active','approved','enabled'].includes(user.status.trim().toLowerCase())) {
          throw new ForbiddenException({error:'Bạn không có quyền quản lý Blog.'});
        }
        return action(client, async (entity,id,verb) => {
          await client.query(`INSERT INTO audit_logs(id,user_id,user_name,user_email,action,entity_type,entity_id,summary)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[`LOG-${randomUUID()}`,actor.id,user.name,user.email,verb,entity,id,`${verb}: nội dung Blog.`]);
        });
      });
    } catch (error) {
      if ((error as {code?:string}).code === '23505') throw new ConflictException({error:'Slug đã tồn tại. Vui lòng chọn slug khác.'});
      if ((error as {code?:string}).code === '23503') throw new ConflictException({error:'Chuyên mục không tồn tại hoặc còn bài viết. Hãy chuyển bài trước khi xóa.'});
      throw error;
    }
  }

  async saveCategory(input: BlogCategoryWrite, actor: AppIdentity, id?: string) {
    return this.write(actor,async (client,audit) => {
      const key=id || randomUUID();
      if (id) {
        const result=await client.query('UPDATE blog_categories SET name=$2,slug=$3 WHERE id=$1 RETURNING id',[id,input.name,input.slug]);
        if (!result.rowCount) throw new NotFoundException({error:'Không tìm thấy chuyên mục.'});
      } else await client.query('INSERT INTO blog_categories(id,name,slug) VALUES ($1,$2,$3)',[key,input.name,input.slug]);
      await audit('blog_category',key,id?'UPDATE':'CREATE');
      return {id:key,...input,postCount:Number((await client.query('SELECT count(*)::int AS count FROM blog_posts WHERE category_id=$1',[key])).rows[0].count)};
    });
  }

  async deleteCategory(id:string,actor:AppIdentity) {
    return this.write(actor,async (client,audit)=>{
      const result=await client.query('DELETE FROM blog_categories WHERE id=$1',[id]);
      if (!result.rowCount) throw new NotFoundException({error:'Không tìm thấy chuyên mục.'});
      await audit('blog_category',id,'DELETE');return {success:true};
    });
  }

  async savePost(input:BlogPostWrite | BlogPostUpdate,actor:AppIdentity,id?:string) {
    const key=await this.write(actor,async (client,audit)=>{
      const key=id || randomUUID();
      const old=id ? (await client.query('SELECT * FROM blog_posts WHERE id=$1 FOR UPDATE',[id])).rows[0] : null;
      if (id && !old) throw new NotFoundException({error:'Không tìm thấy bài viết.'});
      if (old && (!('expectedRevision' in input) || old.revision!==input.expectedRevision)) throw new ConflictException({error:'Bài viết đã thay đổi. Đóng và mở lại để tải dữ liệu mới.'});
      if (old?.published_at && old.slug!==input.slug) throw new ConflictException({error:'Slug của bài đã xuất bản phải giữ ổn định.'});
      const values=[key,input.categoryId,input.title,input.slug,input.excerpt,input.coverImage,input.content,input.status];
      if (old) await client.query(`UPDATE blog_posts SET category_id=$2,title=$3,slug=$4,excerpt=$5,cover_image=$6,content=$7,status=$8,
        published_at=COALESCE(published_at,CASE WHEN $8='published' THEN now() END),revision=revision+1,updated_at=now() WHERE id=$1`,values);
      else await client.query(`INSERT INTO blog_posts(id,category_id,title,slug,excerpt,cover_image,content,status,published_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CASE WHEN $8='published' THEN now() END)`,values);
      await audit('blog_post',key,id?'UPDATE':'CREATE');return key;
    });
    return this.detail(key);
  }

  async deletePost(id:string,revision:number,actor:AppIdentity) {
    return this.write(actor,async(client,audit)=>{
      const result=await client.query('DELETE FROM blog_posts WHERE id=$1 AND revision=$2',[id,revision]);
      if (!result.rowCount) throw new ConflictException({error:'Bài viết đã thay đổi hoặc đã bị xóa. Vui lòng tải lại.'});
      await audit('blog_post',id,'DELETE');return {success:true};
    });
  }
}
