import { CmsPageHeader } from '../../components/cms';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Save } from 'lucide-react';
import { LoadingState } from '../../components/ui/feedback/LoadingState';
import { Alert, Box, Button, MenuItem, Paper, Stack, TextField } from '@mui/material';
import { blogPostWriteSchema, type BlogAdminPost, type BlogCategory, type BlogPostWrite } from '@tinyhouse/contracts';
import { Controller, useForm, zodResolver } from '../../app/forms';
import { RoomDescriptionEditor } from '../rooms/components/RoomDescriptionEditor';
import { compressImageClientSide } from '../../utils/imageCompressor';
import { ApiClient } from '../../services/apiClient';
import { toast } from '../../lib/toast';
import { blogError, useBlogWrite, useBlogCategories, useAdminBlogPost } from './blog.api';

function BlogPostForm({post:initialPost,categories,onClose}:{post?:BlogAdminPost;categories:BlogCategory[];onClose:()=>void}) {
  const [post]=useState(initialPost);
  const save=useBlogWrite();const [uploading,setUploading]=useState(false);
  const {register,control,handleSubmit,watch,setValue,formState:{errors}}=useForm<BlogPostWrite>({resolver:zodResolver(blogPostWriteSchema),defaultValues:post?{
    title:post.title,slug:post.slug,categoryId:post.categoryId,excerpt:post.excerpt,coverImage:post.coverImage,content:post.content,status:post.status,
  }:{title:'',slug:'',categoryId:categories[0]?.id||'',excerpt:'',coverImage:'',content:'',status:'draft'}});
  const busy=save.isPending||uploading;
  return <Box component="form" onSubmit={handleSubmit(async input=>{
      try{await save.mutateAsync({path:post?`posts/${post.id}`:'posts',method:post?'patch':'post',body:post?{...input,expectedRevision:post.revision}:input});toast.success('Đã lưu bài viết.');onClose();}catch(error){toast.error(blogError(error));}
    })}>
      <Stack spacing={3}>
        <Stack direction={{xs:'column',sm:'row'}} sx={{justifyContent:'space-between',gap:2,alignItems:{sm:'center'}}}>
          <CmsPageHeader title={post?'Chỉnh sửa bài viết':'Thêm bài viết'} description={<> Biên tập nội dung, chuyên mục và trạng thái xuất bản. </>} navigation={<><Button onClick={onClose} disabled={busy} startIcon={<ArrowLeft size={18}/>} color="inherit" sx={{mb:1}}>Quay lại danh sách</Button></>} />
          <Button type="submit" variant="contained" startIcon={<Save size={18}/>} disabled={busy}>{busy?'Đang lưu…':'Lưu bài viết'}</Button>
        </Stack>
        <Paper variant="outlined" sx={{p:{xs:2,md:3},borderRadius:3}}><Stack spacing={3}>

        <TextField {...register('title')} label="Tiêu đề" required error={!!errors.title} helperText={errors.title?.message} disabled={busy}/>
        <TextField {...register('slug')} label="Slug" required slotProps={{input:{readOnly:!!post?.publishedAt}}} helperText={errors.slug?.message || (post?.publishedAt?'Slug đã xuất bản được giữ ổn định.':'Ví dụ: kinh-nghiem-chon-phong')} error={!!errors.slug} disabled={busy}/>
        <Stack direction={{xs:'column',sm:'row'}} spacing={2}>
          <Controller control={control} name="categoryId" render={({field})=><TextField {...field} select fullWidth label="Chuyên mục" disabled={busy} error={!!errors.categoryId}>{categories.map(c=><MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</TextField>}/>
          <Controller control={control} name="status" render={({field})=><TextField {...field} select fullWidth label="Trạng thái" disabled={busy}><MenuItem value="draft">Nháp</MenuItem><MenuItem value="published">Đã xuất bản</MenuItem></TextField>}/>
        </Stack>
        <TextField {...register('excerpt')} label="Tóm tắt" required multiline minRows={3} error={!!errors.excerpt} helperText={errors.excerpt?.message} disabled={busy}/>
        <TextField {...register('coverImage')} label="Đường dẫn ảnh bìa" required error={!!errors.coverImage} helperText={errors.coverImage?.message} disabled={busy}/>
        <Button component="label" variant="outlined" disabled={busy}>{uploading?'Đang tải ảnh…':'Tải ảnh bìa'}<input hidden type="file" accept="image/*" onChange={async e=>{
          const file=e.target.files?.[0];e.target.value='';if(!file)return;setUploading(true);
          try{const {base64}=await compressImageClientSide(file,{maxDimension:1600,quality:.85});const result=await ApiClient.post('/v2/upload',{image:base64,fileName:file.name}) as {url:string};setValue('coverImage',result.url,{shouldValidate:true,shouldDirty:true});}catch(error){toast.error(blogError(error));}finally{setUploading(false);}
        }}/></Button>
        {watch('coverImage')&&<Box component="img" src={watch('coverImage')} alt="Ảnh bìa bài viết" sx={{width:'100%',maxHeight:220,objectFit:'cover',borderRadius:2}}/>}
        <Controller control={control} name="content" render={({field})=><RoomDescriptionEditor label="Nội dung bài viết" {...field} disabled={busy} error={errors.content?.message}/>}/>
        </Stack></Paper>
        <Stack direction="row" spacing={1.5} sx={{justifyContent:'flex-end'}}><Button onClick={onClose} disabled={busy} color="inherit">Hủy</Button><Button type="submit" variant="contained" disabled={busy}>{busy?'Đang lưu…':'Lưu bài viết'}</Button></Stack>
      </Stack>
    </Box>;
}


export function BlogPostEditorPage({postId}:{postId?:string}) {
  const navigate=useNavigate();
  const categories=useBlogCategories(true),post=useAdminBlogPost(postId);
  const onClose=()=>navigate('/cms/blog');
  if(categories.isError||(postId&&post.isError))return <Stack spacing={2}>
    <Button onClick={onClose} startIcon={<ArrowLeft size={18}/>} sx={{alignSelf:'flex-start'}}>Quay lại danh sách</Button>
    <Alert severity="error" action={<Button onClick={()=>{void categories.refetch();if(postId)void post.refetch();}}>Tải lại</Button>}>{post.isError?blogError(post.error):'Không tải được chuyên mục.'}</Alert>
  </Stack>;
  if(categories.isPending||(postId&&post.isPending))return <LoadingState/>;
  if(!categories.data?.length)return <Stack spacing={2}><Alert severity="info">Tạo chuyên mục trước khi thêm bài viết.</Alert><Button onClick={onClose} sx={{alignSelf:'flex-start'}}>Về danh sách</Button></Stack>;
  return <BlogPostForm key={postId||'new'} post={post.data} categories={categories.data} onClose={onClose}/>;
}
