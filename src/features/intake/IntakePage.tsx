import { CmsFilterField, CmsActionsCell, CmsRowActions, CmsPageHeader, CmsListCard, CmsFilterBar, CmsBadge as Chip, CmsTable as Table, CmsTablePagination as TablePagination } from '../../components/cms';

import { useState } from 'react';
import { Alert, Box, Button, InputAdornment, LinearProgress, MenuItem, Stack, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Eye, Inbox, Search } from 'lucide-react';
import { useSearchParams } from 'react-router';
import type { IntakeListQuery } from '@tinyhouse/contracts';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { EmptyState } from '../../components/ui/feedback/EmptyState';
import { LoadingState } from '../../components/ui/feedback/LoadingState';
import { useIntakeList } from './intake.api';
import { intakeColors, intakeDate, intakeKinds, intakeStatuses } from './intakePresentation';
import { IntakeDetailDialog } from './IntakeDetailDialog';

export function IntakePage() {
  const [params,setParams] = useSearchParams();
  const selected = params.get('request');
  const [search,setSearch] = useState('');
  const [kind,setKind] = useState('');
  const [status,setStatus] = useState('');
  const [order,setOrder] = useState<'asc'|'desc'>('desc');
  const [page,setPage] = useState(0);
  const [pageSize,setPageSize] = useState(10);
  const debounced = useDebouncedValue(search,350);
  const query = useIntakeList({ search: debounced, kind: kind as IntakeListQuery['kind'] || undefined,
    status: status as IntakeListQuery['status'] || undefined, order, sort: 'createdAt', page: page+1, pageSize });
  const select = (id?: string) => { const next = new URLSearchParams(params); if (id) next.set('request',id); else next.delete('request'); setParams(next,{replace:true}); };
  const count = query.data?.pagination.total || 0;
  return <Stack spacing={3}>
    <CmsPageHeader title={<> Yêu cầu tư vấn / hợp tác </>} description={<> Tiếp nhận, liên hệ và theo dõi kết quả xử lý. </>} />
    {query.isError && <Alert severity="error" action={<Button onClick={()=>void query.refetch()} color="inherit">Thử lại</Button>}>Không tải được danh sách yêu cầu.</Alert>}
    <CmsListCard variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ height: 3 }}>{query.isFetching && <LinearProgress sx={{ height: 3 }} />}</Box>
      <CmsFilterBar>
        <CmsFilterField label="Tìm yêu cầu" placeholder="Tên, SĐT hoặc nhu cầu" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}
          slotProps={{ inputLabel: { shrink:true }, input:{startAdornment:<InputAdornment position="start"><Search size={18}/></InputAdornment>} }} />
        <CmsFilterField select label="Loại yêu cầu" value={kind} onChange={e=>{setKind(e.target.value);setPage(0);}} slotProps={{ inputLabel:{shrink:true},select:{displayEmpty:true} }}>
          <MenuItem value="">Tất cả loại yêu cầu</MenuItem>{Object.entries(intakeKinds).map(([value,label])=><MenuItem key={value} value={value}>{label}</MenuItem>)}
        </CmsFilterField>
        <CmsFilterField select label="Trạng thái" value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}} slotProps={{ inputLabel:{shrink:true},select:{displayEmpty:true} }}>
          <MenuItem value="">Tất cả trạng thái</MenuItem>{Object.entries(intakeStatuses).map(([value,label])=><MenuItem key={value} value={value}>{label}</MenuItem>)}
        </CmsFilterField>
        <CmsFilterField select label="Thời gian nhận" value={order} onChange={e=>{setOrder(e.target.value as 'asc'|'desc');setPage(0);}}>
          <MenuItem value="desc">Mới nhất</MenuItem><MenuItem value="asc">Cũ nhất</MenuItem>
        </CmsFilterField>
      </CmsFilterBar>
      {!query.data && !query.isError ? <LoadingState /> : <>
        <TableContainer><Table sx={{ minWidth: 820 }} aria-label="Yêu cầu tư vấn và hợp tác">
          <TableHead><TableRow>{['Người gửi','Loại yêu cầu','Nhu cầu','Tiếp nhận lúc','Trạng thái'].map(label=><TableCell key={label}>{label}</TableCell>)}<CmsActionsCell>Thao tác</CmsActionsCell></TableRow></TableHead>
          <TableBody>{query.data?.items.map(item=><TableRow key={item.id} hover>
            <TableCell><Typography variant="body2" sx={{ fontWeight: 700, maxWidth:200,overflowWrap:'anywhere' }}>{item.name}</Typography><Typography variant="body2" component="a" href={`tel:${item.phone}`} color="text.secondary">{item.phone}</Typography></TableCell>
            <TableCell>{intakeKinds[item.kind]}</TableCell>
            <TableCell sx={{ maxWidth:260 }}><Typography variant="body2" sx={{ display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical',overflow:'hidden',overflowWrap:'anywhere' }}>{item.need || '-'}</Typography></TableCell>
            <TableCell sx={{ whiteSpace:'nowrap' }}>{intakeDate(item.createdAt)}</TableCell>
            <TableCell><Chip size="small" color={intakeColors[item.status]} label={intakeStatuses[item.status]} sx={{color:'common.white'}} /></TableCell>
            <CmsActionsCell><CmsRowActions actions={[{id:'action-0',label:`Xem yêu cầu của ${item.name}`,icon:<Eye size={18}/>,onClick:()=>select(item.id)}]} /></CmsActionsCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>
        {!query.isError && !query.data?.items.length && <EmptyState icon={<Inbox size={32}/>} title="Chưa có yêu cầu phù hợp" description="Các yêu cầu được gửi sẽ xuất hiện tại đây." />}
        <TablePagination component="div" count={count} page={page} rowsPerPage={pageSize} rowsPerPageOptions={[10,20,50]} onPageChange={(_,next)=>setPage(next)}
          onRowsPerPageChange={e=>{setPageSize(Number(e.target.value));setPage(0);}} labelRowsPerPage="Số dòng" labelDisplayedRows={({from,to,count:total})=>`${from}–${to} / ${total}`} />
      </>}
    </CmsListCard>
    {selected && <IntakeDetailDialog key={selected} id={selected} onClose={()=>select()} />}
  </Stack>;
}
