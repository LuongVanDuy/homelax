import { Alert, Box, Button, Chip, Pagination, Paper, Stack, Tab, Tabs, Typography } from '@mui/material';
import { ArrowRight, CalendarDays, Newspaper } from 'lucide-react';
import { useSearchParams } from 'react-router';
import type { BlogPostCard } from '@tinyhouse/contracts';
import { PublicContainer, PublicImage, PublicListingGrid, PublicSurface } from '../../components/public';
import { PublicLink } from '../../app/router/PublicLink';
import { LoadingState } from '../../components/ui/feedback/LoadingState';
import { useBlogCategories, useBlogPosts } from './blog.api';

import { blogDate } from './blogPresentation';
import { designTokens } from '../../app/theme/tokens';

const blogSurfaceSx = {
  borderColor: designTokens.colors.neutral[200],
  borderRadius: `${designTokens.radius.lg}px`,
  boxShadow: designTokens.shadows.xs,
};
export function BlogCard({post,featured=false}:{post:BlogPostCard;featured?:boolean}) {
  return <Paper component="article" variant="outlined" sx={{...blogSurfaceSx,overflow:'hidden',height:'100%',display:'flex',flexDirection:featured?{xs:'column',md:'row'}:'column',transition:'box-shadow .2s', '&:hover':{boxShadow:designTokens.shadows.sm}}}>
    <Box component={PublicLink} to={`/tin-tuc/${post.slug}`} tabIndex={-1} aria-hidden="true" sx={{display:'block',width:featured?{xs:'100%',md:'52%'}:'100%',flexShrink:0,position:'relative'}}>
      <PublicImage src={post.coverImage} alt={post.title} priority={featured} aspectRatio={featured?'16 / 10':'16 / 9'}/>
      {featured&&<Chip label="Bài viết mới" color="primary" size="small" sx={{position:'absolute',left:20,top:20}}/>}
    </Box>
    <Stack spacing={featured?2:1.5} sx={{p:featured?{xs:2.5,md:4}:2.5,flex:1,justifyContent:'center',minWidth:0}}>
      <Typography variant="caption" component={PublicLink} to={`/tin-tuc?category=${post.category.slug}`} sx={{color:'primary.main',fontWeight:700,textTransform:'uppercase',letterSpacing:.6}}>{post.category.name}</Typography>
      <Typography component="h2" sx={{fontSize:featured?{xs:24,md:30}:20,fontWeight:800,lineHeight:1.35,overflowWrap:'anywhere'}}><Box component={PublicLink} to={`/tin-tuc/${post.slug}`} sx={{color:'inherit',textDecoration:'none','&:hover':{color:'primary.main'}}}>{post.title}</Box></Typography>
      <Typography color="text.secondary" variant="body2" sx={{lineHeight:1.75,display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{post.excerpt}</Typography>
      <Stack direction="row" spacing={1} sx={{alignItems:'center',color:'text.secondary',pt:.5}}><CalendarDays size={15}/><Typography variant="caption">{blogDate(post.publishedAt)}</Typography></Stack>
      <Box sx={{flex:1}}/>
      <Button component={PublicLink} to={`/tin-tuc/${post.slug}`} endIcon={<ArrowRight size={17}/>} sx={{alignSelf:'flex-start',px:0}}>Đọc bài viết</Button>
    </Stack>
  </Paper>;
}

export function PublicBlogPage() {
  const [params,setParams]=useSearchParams();const category=params.get('category')||'';
  const rawPage=Number(params.get('page'));const page=Number.isInteger(rawPage)&&rawPage>0&&rawPage<=1000000?rawPage:1;
  const categories=useBlogCategories(),query=useBlogPosts({category,page,pageSize:7});
  const update=(key:string,value:string)=>{const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);if(key==='category')next.delete('page');setParams(next);};
  const items=query.data?.items||[];const featured=page===1?items[0]:undefined;
  const unknown=!!category&&!!categories.data&&!categories.data.some(c=>c.slug===category);
  return <PublicSurface><PublicContainer><Stack spacing={4} sx={{py:{xs:4,md:6}}}>
    <Box><Typography variant="overline" color="primary.main" sx={{fontWeight:800,letterSpacing:1.5}}>GÓC CHIA SẺ HOMELAX</Typography><Typography component="h1" sx={{fontSize:{xs:30,md:40},fontWeight:800,mt:1,mb:1.5}}>Tin tức & Kinh nghiệm thuê phòng</Typography><Typography color="text.secondary">Gợi ý tìm phòng, chăm chút không gian sống và cập nhật từ Homelax.</Typography></Box>
    {categories.isError?<Alert severity="error" action={<Button onClick={()=>void categories.refetch()}>Thử lại</Button>}>Không tải được chuyên mục.</Alert>:<Tabs value={category} variant="scrollable" scrollButtons="auto" onChange={(_,value)=>update('category',value)} aria-label="Chuyên mục bài viết" sx={{borderBottom:1,borderColor:'divider'}}><Tab label="Tất cả" value=""/>{categories.data?.map(c=><Tab key={c.id} label={c.name} value={c.slug}/>)}{category&&!categories.data?.some(c=>c.slug===category)&&<Tab value={category} label={categories.isPending?'Đang tải chuyên mục…':'Chuyên mục không còn tồn tại'}/>}</Tabs>}
    {query.isPending?<LoadingState/>:query.isError?<Alert severity="error" action={<Button onClick={()=>void query.refetch()}>Thử lại</Button>}>Không tải được bài viết. Vui lòng thử lại.</Alert>:<>
      {featured&&<Box><Typography variant="overline" color="text.secondary" sx={{fontWeight:700,display:'block',mb:1.5}}>ĐÁNG CHÚ Ý</Typography><BlogCard post={featured} featured/></Box>}
      {(featured?items.length>1:items.length>0)&&<Box><Typography component="h2" variant="h5" sx={{fontWeight:800,mb:2.5}}>Bài viết mới nhất</Typography><PublicListingGrid>{(featured?items.slice(1):items).map(post=><BlogCard key={post.id} post={post}/>)}</PublicListingGrid></Box>}
      {!items.length&&<Paper variant="outlined" sx={{...blogSurfaceSx,p:5,textAlign:'center'}}><Newspaper size={36}/><Typography component="h2" variant="h6" sx={{mt:2}}>{unknown?'Chuyên mục không còn tồn tại':'Chưa có bài viết ở đây'}</Typography><Button onClick={()=>{const next=new URLSearchParams(params);next.delete('category');next.delete('page');setParams(next);}}>Xem tất cả bài viết</Button></Paper>}
      {(query.data?.pagination.totalPages||0)>1&&<Pagination count={query.data!.pagination.totalPages} page={page} onChange={(_,value)=>update('page',String(value))} color="primary" sx={{alignSelf:'center'}}/>}
    </>}
    <Paper variant="outlined" sx={{...blogSurfaceSx,p:{xs:3,md:4},display:'flex',flexWrap:'wrap',alignItems:'center',justifyContent:'space-between',gap:2}}><Box><Typography component="h2" variant="h5" sx={{fontWeight:800}}>Tìm một nơi để gọi là nhà</Typography><Typography color="text.secondary" sx={{mt:1}}>Khám phá các tòa nhà và căn phòng phù hợp với bạn.</Typography></Box><Button component={PublicLink} to="/tim-phong" variant="contained" endIcon={<ArrowRight size={18}/>}>Khám phá phòng</Button></Paper>
  </Stack></PublicContainer></PublicSurface>;
}
