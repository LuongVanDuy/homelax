import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blogCategoriesSchema, blogAdminPostSchema, blogAdminPageSchema, blogPublicPageSchema, blogPublicPostSchema, type BlogListQuery } from '@tinyhouse/contracts';
import { ApiClient } from '../../services/apiClient';
import { listQueryString } from '../../lib/api/listQuery';
import { accountSessionGuard } from '../account/api/account.api';
import { IdentityStore, getIdentityScope } from '../auth/identityStore';

const publicSessionRetry=(attempt:number,error:unknown)=>attempt<1&&(error as {code?:string})?.code==='SESSION_CHANGED';

export function useBlogCategories(admin = false) {
  const guard = accountSessionGuard();
  return useQuery({ queryKey:['blog',admin ? getIdentityScope(IdentityStore.get()) : 'public','categories'], retry:admin?false:publicSessionRetry,
    queryFn:async()=>{ if(admin)guard(); const result=await ApiClient.get(`/v2/${admin?'':'public/'}blog/categories`,{bypassCache:true}); if(admin)guard();return blogCategoriesSchema.parse(result); } });
}
export function useBlogPosts(params:Partial<BlogListQuery>,admin=false) {
  const guard=accountSessionGuard();
  return useQuery({queryKey:['blog',admin?getIdentityScope(IdentityStore.get()):'public','posts',params],retry:admin?false:publicSessionRetry,staleTime:0,
    queryFn:async()=>{if(admin)guard();const result=await ApiClient.get(`/v2/${admin?'':'public/'}blog/posts${listQueryString(params)}`,{bypassCache:true});if(admin)guard();return admin?blogAdminPageSchema.parse(result):blogPublicPageSchema.parse(result);}});
}
export function useBlogPost(slug:string) {
  return useQuery({queryKey:['blog','public','post',slug],retry:publicSessionRetry,staleTime:0,
    queryFn:async()=>blogPublicPostSchema.parse(await ApiClient.get(`/v2/public/blog/posts/${encodeURIComponent(slug)}`,{bypassCache:true}))});
}
export function useAdminBlogPost(id?:string) {
  const guard=accountSessionGuard();
  return useQuery({queryKey:['blog',getIdentityScope(IdentityStore.get()),'post',id],enabled:!!id,retry:false,refetchOnWindowFocus:false,
    queryFn:async()=>{guard();const result=await ApiClient.get(`/v2/blog/posts/${encodeURIComponent(id!)}`,{bypassCache:true});guard();return blogAdminPostSchema.parse(result);}});
}
export function useBlogWrite() {
  const client=useQueryClient();const guard=accountSessionGuard();
  return useMutation({retry:false,mutationFn:async({path,method,body}:{path:string;method:'post'|'patch'|'delete';body?:unknown})=>{
    guard();const result=await ApiClient[method](`/v2/blog/${path}`,body);guard();return result;
  },onSuccess:()=>{guard();void client.invalidateQueries({queryKey:['blog']});void client.invalidateQueries({queryKey:['audit-logs']});}});
}
export const blogError=(error:unknown)=>error instanceof Error?error.message:'Không thể lưu thay đổi. Vui lòng thử lại.';
