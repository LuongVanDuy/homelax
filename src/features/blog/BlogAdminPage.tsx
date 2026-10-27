import { CmsFilterField, CmsFilterBar, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../components/cms';

import { useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Tab, Tabs, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { ExternalLink, Pencil, Plus, Trash2 } from 'lucide-react';
import { blogCategoryWriteSchema, type BlogAdminPost, type BlogCategory, type BlogCategoryWrite } from '@tinyhouse/contracts';
import { useForm, zodResolver } from '../../app/forms';
import { ConfirmDialog } from '../../components/ui/dialogs/ConfirmDialog';
import { LoadingState } from '../../components/ui/feedback/LoadingState';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { toast } from '../../lib/toast';
import { blogError, useBlogCategories, useBlogPosts, useBlogWrite } from './blog.api';
import { useNavigate } from 'react-router';

function CategoryEditor({category,onClose}:{category?:BlogCategory;onClose:()=>void}) {
  const save=useBlogWrite();const {register,handleSubmit,formState:{errors}}=useForm<BlogCategoryWrite>({resolver:zodResolver(blogCategoryWriteSchema),defaultValues:{name:category?.name||'',slug:category?.slug||''}});
  return <Dialog open fullWidth maxWidth="sm" onClose={save.isPending?undefined:onClose}><Box component="form" onSubmit={handleSubmit(async body=>{
    try{await save.mutateAsync({path:category?`categories/${category.id}`:'categories',method:category?'patch':'post',body});toast.success('Đã lưu chuyên mục.');onClose();}catch(error){toast.error(blogError(error));}
  })}><DialogTitle>{category?'Sửa chuyên mục':'Thêm chuyên mục'}</DialogTitle><DialogContent><Stack spacing={2.5} sx={{pt:1}}>
    <TextField label="Tên chuyên mục" {...register('name')} required error={!!errors.name} helperText={errors.name?.message} disabled={save.isPending}/>
    <TextField label="Slug" {...register('slug')} required error={!!errors.slug} helperText={errors.slug?.message} disabled={save.isPending}/>
  </Stack></DialogContent><DialogActions sx={{p:2}}><Button onClick={onClose} disabled={save.isPending}>Hủy</Button><Button type="submit" variant="contained" disabled={save.isPending}>Lưu chuyên mục</Button></DialogActions></Box></Dialog>;
}

export function BlogAdminPage() {
  const navigate = useNavigate();
  const [tab,setTab]=useState(0),[page,setPage]=useState(0),[search,setSearch]=useState('');
  const [category,setCategory]=useState(''),[status,setStatus]=useState<''|'draft'|'published'>('');
  const [categoryEditor,setCategoryEditor]=useState<BlogCategory|'new'|null>(null);
  const [deleting,setDeleting]=useState<{path:string;name:string;revision?:number}|null>(null);
  const categories=useBlogCategories(true), posts=useBlogPosts({page:page+1,pageSize:10,search:useDebouncedValue(search,300),category,status},true),save=useBlogWrite();
  const rows=(posts.data?.items||[]) as BlogAdminPost[];
  return <Stack spacing={3}>
    <CmsPageHeader title={<> Bài viết & Chuyên mục </>} description={<> Biên tập tin tức và nội dung trên trang web. </>} actions={<><Button variant="contained" startIcon={<Plus size={18}/>} disabled={tab===0&&(!categories.data?.length||categories.isError)} onClick={()=>tab===0?navigate('/cms/blog/new'):setCategoryEditor('new')}>{tab===0?'Thêm bài viết':'Thêm chuyên mục'}</Button></>} />
    <Tabs value={tab} onChange={(_,value)=>setTab(value)}><Tab label="Bài viết"/><Tab label="Chuyên mục"/></Tabs>
    {(categories.isError||posts.isError)&&<Alert severity="error" action={<Button onClick={()=>{void categories.refetch();void posts.refetch();}}>Tải lại</Button>}>Không tải được dữ liệu Blog.</Alert>}
    <CmsListCard variant="outlined" sx={{borderRadius:3,overflow:'hidden'}}>
      {tab===0?<>
        <CmsFilterBar>
          <CmsFilterField label="Tìm bài viết" value={search} sx={{minWidth:0,gridColumn:{sm:'1 / -1',lg:'auto'}}} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>
          <CmsFilterField select label="Chuyên mục" value={category} sx={{minWidth:0}} onChange={e=>{setCategory(e.target.value);setPage(0);}} slotProps={{inputLabel:{shrink:true},select:{displayEmpty:true}}}><MenuItem value="">Tất cả chuyên mục</MenuItem>{categories.data?.map(c=><MenuItem key={c.id} value={c.slug}>{c.name}</MenuItem>)}</CmsFilterField>
          <CmsFilterField select label="Trạng thái" value={status} sx={{minWidth:0}} onChange={e=>{setStatus(e.target.value as typeof status);setPage(0);}} slotProps={{inputLabel:{shrink:true},select:{displayEmpty:true}}}><MenuItem value="">Tất cả trạng thái</MenuItem><MenuItem value="draft">Nháp</MenuItem><MenuItem value="published">Đã xuất bản</MenuItem></CmsFilterField>
        </CmsFilterBar>
        {posts.isPending?<LoadingState/>:<TableContainer><Table sx={{minWidth:760}}><TableHead><TableRow>{['Bài viết','Chuyên mục','Trạng thái','Ngày đăng','Thao tác'].map(label=><TableCell key={label} align={label==='Thao tác'?'right':'left'} sx={label==='Thao tác'?{width:"1%",whiteSpace:'nowrap'}:undefined}>{label}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map(post=><TableRow key={post.id}>
          <TableCell><Stack direction="row" spacing={1.5} sx={{alignItems:'center'}}><Box component="img" src={post.coverImage} alt="" sx={{width:76,height:52,objectFit:'cover',borderRadius:1.5}}/><Box><Typography variant="body2" sx={{fontWeight:700,maxWidth:360}}>{post.title}</Typography><Typography variant="caption" color="text.secondary">/{post.slug}</Typography></Box></Stack></TableCell>
          <TableCell>{post.category.name}</TableCell><TableCell><Chip size="small" color={post.status==='published'?'success':'secondary'} label={post.status==='published'?'Đã xuất bản':'Nháp'}/></TableCell><TableCell sx={{whiteSpace:'nowrap'}}>{post.publishedAt?new Date(post.publishedAt).toLocaleDateString('vi-VN'):'-'}</TableCell>
          <CmsActionsCell><CmsRowActions actions={[{id:'action-0',label:`Mở ${post.title}`,icon:<ExternalLink size={18}/>,href:`/tin-tuc/${post.slug}`,external:true,hidden:!(post.status==='published')},
{id:'action-1',label:`Sửa ${post.title}`,icon:<Pencil size={18}/>,onClick:()=>navigate(`/cms/blog/${encodeURIComponent(post.id)}/edit`)},
{id:'action-2',label:`Xóa ${post.title}`,icon:<Trash2 size={18}/>,onClick:()=>setDeleting({path:`posts/${post.id}`,name:post.title,revision:post.revision}),danger:true}]} /></CmsActionsCell>
        </TableRow>)}</TableBody></Table></TableContainer>}
        {!posts.isPending&&!rows.length&&<Typography sx={{p:3,textAlign:'center'}}>Chưa có bài viết phù hợp.</Typography>}
        <TablePagination component="div" count={posts.data?.pagination.total||0} page={page} rowsPerPage={10} rowsPerPageOptions={[10]} onPageChange={(_,next)=>setPage(next)} labelDisplayedRows={({from,to,count})=>`${from}–${to} / ${count}`}/>
      </>:<TableContainer><Table><TableHead><TableRow><TableCell>Chuyên mục</TableCell><TableCell>Slug</TableCell><TableCell>Số bài</TableCell><CmsActionsCell>Thao tác</CmsActionsCell></TableRow></TableHead><TableBody>{categories.data?.map(c=><TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell>{c.slug}</TableCell><TableCell>{c.postCount}</TableCell><CmsActionsCell><CmsRowActions actions={[{id:'action-0',label:`Sửa ${c.name}`,icon:<Pencil size={18}/>,onClick:()=>setCategoryEditor(c)},
{id:'action-1',label:`Xóa ${c.name}`,icon:<Trash2 size={18}/>,onClick:()=>setDeleting({path:`categories/${c.id}`,name:c.name}),disabled:c.postCount>0,danger:true}]} /></CmsActionsCell></TableRow>)}</TableBody></Table><Typography variant="body2" color="text.secondary" sx={{p:2}}>Chuyển các bài sang chuyên mục khác trước khi xóa chuyên mục còn bài.</Typography></TableContainer>}
    </CmsListCard>
    {categoryEditor&&<CategoryEditor category={categoryEditor==='new'?undefined:categoryEditor} onClose={()=>setCategoryEditor(null)}/>}
    <ConfirmDialog open={!!deleting} title="Xóa nội dung?" description={deleting?.name} confirmLabel="Xóa" danger loading={save.isPending} onClose={()=>setDeleting(null)} onConfirm={async()=>{
      if(!deleting)return;try{await save.mutateAsync({path:deleting.path,method:'delete',body:deleting.revision===undefined?undefined:{expectedRevision:deleting.revision}});setDeleting(null);toast.success('Đã xóa nội dung.');}catch(error){toast.error(blogError(error));}
    }}/>
  </Stack>;
}
