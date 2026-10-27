import { useEffect } from 'react';
import { Alert, Box, Breadcrumbs, Button, Chip, Paper, Stack, Typography } from '@mui/material';
import { ArrowLeft, CalendarDays, Share2 } from 'lucide-react';
import { useParams } from 'react-router';
import { PublicContainer, PublicSurface } from '../../components/public';
import { PublicLink } from '../../app/router/PublicLink';
import { LoadingState } from '../../components/ui/feedback/LoadingState';
import { roomDescriptionDisplayHtml } from '../rooms/roomDescription';
import { toast } from '../../lib/toast';
import { useBlogPost } from './blog.api';
import { blogDate } from './blogPresentation';

export function PublicBlogDetailPage() {
  const {blogId=''}=useParams();const query=useBlogPost(blogId),post=query.data;
  useEffect(()=>{if(post)document.title=`${post.title} - Homelax`;},[post]);
  const share=async()=>{try{const data={title:post?.title,url:window.location.href};if(navigator.share)await navigator.share(data);else{await navigator.clipboard.writeText(data.url);toast.success('Đã sao chép liên kết.');}}catch(error){if((error as Error).name!=='AbortError')toast.error('Không thể chia sẻ. Bạn có thể sao chép địa chỉ trên trình duyệt.');}};
  return <PublicSurface><PublicContainer><Box sx={{py:{xs:3,md:5}}}>
    <Button component={PublicLink} to="/tin-tuc" startIcon={<ArrowLeft size={18}/>} color="secondary" sx={{mb:3}}>Về tin tức</Button>
    {query.isPending?<LoadingState/>:query.isError?<Alert severity="warning" action={<Button onClick={()=>void query.refetch()}>Tải lại</Button>}>{(query.error as {status?:number}).status===404?'Bài viết không tồn tại hoặc chưa được xuất bản.':'Không thể tải bài viết. Vui lòng thử lại.'}</Alert>:post&&<>
      <Box sx={{maxWidth:860,mx:'auto'}}>
        <Breadcrumbs sx={{mb:3}}><Box component={PublicLink} to="/tin-tuc" sx={{color:'text.secondary'}}>Tin tức</Box><Box component={PublicLink} to={`/tin-tuc?category=${post.category.slug}`} sx={{color:'text.secondary'}}>{post.category.name}</Box></Breadcrumbs>
        <Chip component={PublicLink} to={`/tin-tuc?category=${post.category.slug}`} label={post.category.name} color="primary" clickable size="small"/>
        <Typography component="h1" sx={{fontSize:{xs:30,md:42},fontWeight:800,lineHeight:1.25,my:2.5,overflowWrap:'anywhere'}}>{post.title}</Typography>
        <Stack direction="row" sx={{alignItems:'center',justifyContent:'space-between',gap:2,mb:3}}><Stack direction="row" spacing={1} sx={{alignItems:'center',color:'text.secondary'}}><CalendarDays size={17}/><Typography variant="body2">{blogDate(post.publishedAt)} · Homelax</Typography></Stack><Button onClick={()=>void share()} startIcon={<Share2 size={17}/>}>Chia sẻ</Button></Stack>
        <Typography sx={{fontSize:18,lineHeight:1.8,color:'text.secondary',mb:3}}>{post.excerpt}</Typography>
        <Box component="img" src={post.coverImage} alt={post.title} sx={{display:'block',width:'100%',maxHeight:520,objectFit:'cover',borderRadius:3,mb:4}}/>
        <Box component="article" sx={{fontSize:16,lineHeight:1.85,overflowWrap:'anywhere','& h2':{fontSize:{xs:23,md:28},fontWeight:800,lineHeight:1.4,mt:4,mb:1.5},'& h3':{fontSize:21,fontWeight:700,mt:3},'& p':{mb:2},'& ul,& ol':{pl:3,mb:2},'& ul':{listStyleType:'disc'},'& ol':{listStyleType:'decimal'},'& a':{color:'primary.main',textDecoration:'underline'},'& table':{display:'block',overflowX:'auto',maxWidth:'100%'},'& td,& th':{border:1,borderColor:'divider',p:1},'& blockquote':{borderLeft:3,borderColor:'primary.main',pl:2,color:'text.secondary'}}} dangerouslySetInnerHTML={{__html:roomDescriptionDisplayHtml(post.content)}}/>
        <Paper variant="outlined" sx={{p:3,mt:5,borderRadius:3}}><Typography component="h2" variant="h6" sx={{fontWeight:800}}>Bạn đang tìm phòng?</Typography><Typography color="text.secondary" sx={{my:1}}>Xem thông tin tòa nhà, chọn căn phù hợp và đặt lịch xem trực tiếp.</Typography><Button component={PublicLink} to="/tim-phong" variant="contained" sx={{mt:1}}>Tìm phòng ngay</Button></Paper>
      </Box>
    </>}
  </Box></PublicContainer></PublicSurface>;
}
