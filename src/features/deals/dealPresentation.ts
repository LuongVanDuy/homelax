import type { DealSummary } from '@tinyhouse/contracts';

export type DealStageTone = 'neutral' | 'info' | 'warning' | 'success' | 'error';

export type DealStage = {
  key: string;
  label: string;
  tone: DealStageTone;
  nextAction: string;
};

export function formatDealMoney(value: number) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
}

function todayVietnam() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

export function getDealStage(deal: DealSummary): DealStage {
  if (deal.lifecycleStatus === 'cancelled') {
    return {
      key: 'cancelled',
      label: 'Đã hủy',
      tone: 'error',
      nextAction: 'Giao dịch đã kết thúc. Dữ liệu và lịch sử vẫn được giữ.',
    };
  }

  if (!deal.contractSigned) {
    return {
      key: 'waiting-contract',
      label: 'Chờ ký hợp đồng',
      tone: 'warning',
      nextAction: 'Xác nhận hợp đồng khi khách đã ký.',
    };
  }

  if (deal.depositRequiredAmount === null || deal.depositRequiredAmount <= 0) {
    return {
      key: 'waiting-deposit-rule',
      label: 'Chờ xác định tiền cọc',
      tone: 'warning',
      nextAction: 'Nhập mức tiền cọc khách cần đóng.',
    };
  }

  if (deal.depositPaidAmount <= 0) {
    return {
      key: 'waiting-deposit',
      label: 'Đã ký · chờ cọc',
      tone: 'warning',
      nextAction: 'Ghi nhận tiền cọc khi khách thanh toán.',
    };
  }

  if (!deal.depositFullyPaid) {
    const remaining = Math.max(0, deal.depositRequiredAmount - deal.depositPaidAmount);
    return {
      key: 'partial-deposit',
      label: 'Đang cọc',
      tone: 'info',
      nextAction: `Còn thiếu ${formatDealMoney(remaining)} tiền cọc.`,
    };
  }

  if (!deal.rentalStartDate) {
    return {
      key: 'full-deposit',
      label: 'Đủ cọc',
      tone: 'success',
      nextAction: 'Cập nhật lịch thuê hoặc ngày khách vào ở.',
    };
  }

  const today = todayVietnam();
  if (deal.rentalStartDate > today) {
    return {
      key: 'waiting-move-in',
      label: 'Chờ vào ở',
      tone: 'success',
      nextAction: `Bắt đầu thuê ngày ${deal.rentalStartDate}.`,
    };
  }

  if (deal.rentalEndDate && deal.rentalEndDate < today) {
    return {
      key: 'schedule-ended',
      label: 'Hết lịch thuê',
      tone: 'warning',
      nextAction: 'Kiểm tra kết thúc thuê hoặc cập nhật lịch mới.',
    };
  }

  return {
    key: 'renting',
    label: 'Đang thuê',
    tone: 'success',
    nextAction: deal.rentalEndDate
      ? `Theo dõi đến ngày ${deal.rentalEndDate}.`
      : 'Theo dõi giao dịch và cập nhật ngày kết thúc khi xác định.',
  };
}
