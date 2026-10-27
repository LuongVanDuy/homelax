import React from 'react';
import {
  // Common & Building icons
  ArrowUpDown, Wifi, WashingMachine, Sun, Car, Users, Sparkles,
  Camera, Fingerprint, CreditCard, ShieldCheck, UserCheck, DoorClosed,
  Flame, Bell, BellRing, Droplets, Droplet, Lightbulb, Compass,
  Fan, ShieldAlert, HeartPulse, Footprints, ArrowUpRight, MapPin,
  // Room & Furniture icons
  Bed, BedDouble, Shirt, UtensilsCrossed, Armchair, Coffee, Tv, Blinds,
  Sparkle, Wind, Refrigerator, AirVent, Microwave, Utensils,
  ChefHat, Bath, Trees, AppWindow, Layers, Home, Zap, Gauge,
  Check
} from 'lucide-react';

// Presentation only: assigned amenity names come from the public API.
const normalizeAmenity = (str) => {
  return String(str || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, '');
};

export const getAmenityIcon = (label, size = 18, color = '#64748B') => {
  const norm = normalizeAmenity(label);

  // Thang máy
  if (norm.includes('thangmay')) return <ArrowUpDown size={size} color={color} />;

  // Wifi
  if (norm.includes('wifi')) return <Wifi size={size} color={color} />;

  // Máy giặt
  if (norm.includes('maygiat')) return <WashingMachine size={size} color={color} />;

  // Máy sấy
  if (norm.includes('maysay')) return <Wind size={size} color={color} />;

  // Sân phơi
  if (norm.includes('sanphoi')) return <Sun size={size} color={color} />;

  // Khu để xe / Bãi ô tô
  if (norm.includes('oto') || norm.includes('xe')) return <Car size={size} color={color} />;

  // Sinh hoạt chung / Cư dân
  if (norm.includes('sinhhoatchung') || norm.includes('cudan')) return <Users size={size} color={color} />;

  // Dọn vệ sinh
  if (norm.includes('vesinh') || norm.includes('don')) return <Sparkles size={size} color={color} />;

  // Camera
  if (norm.includes('camera')) return <Camera size={size} color={color} />;

  // Khóa vân tay / mã số
  if (norm.includes('vantay') || norm.includes('khoa')) return <Fingerprint size={size} color={color} />;

  // Thẻ từ
  if (norm.includes('thetu')) return <CreditCard size={size} color={color} />;

  // Bảo vệ
  if (norm.includes('baove')) return <ShieldCheck size={size} color={color} />;

  // Quản lý tòa nhà
  if (norm.includes('quanly')) return <UserCheck size={size} color={color} />;

  // Cổng kiểm soát / Cửa chống cháy
  if (norm.includes('congkiemsoat') || norm.includes('cuachongchay')) return <DoorClosed size={size} color={color} />;

  // Bình chữa cháy / Bình cứu hỏa
  if (norm.includes('binhchuachay') || norm.includes('binhcuuhoa')) return <Flame size={size} color={color} />;

  // Báo cháy / Chuông báo cháy / Hệ thống báo cháy / Báo khói / Báo nhiệt
  if (norm.includes('chuong') || norm.includes('hethongbaochay') || norm.includes('baochay')) return <BellRing size={size} color={color} />;
  if (norm.includes('baokhoi') || norm.includes('daubao')) return <Bell size={size} color={color} />;
  if (norm.includes('sprinkler')) return <Droplets size={size} color={color} />;
  if (norm.includes('hongnuoc') || norm.includes('voinuoc')) return <Droplet size={size} color={color} />;
  if (norm.includes('denchieu') || norm.includes('suco')) return <Lightbulb size={size} color={color} />;
  if (norm.includes('bienchidan') || norm.includes('sodo') || norm.includes('noiquy')) return <Compass size={size} color={color} />;
  if (norm.includes('hutkhoi') || norm.includes('tangap')) return <Fan size={size} color={color} />;
  if (norm.includes('matna') || norm.includes('phongdoc')) return <ShieldAlert size={size} color={color} />;
  if (norm.includes('cuunan') || norm.includes('cuuho')) return <HeartPulse size={size} color={color} />;

  // Thoát nạn
  if (norm.includes('cauthang') || norm.includes('loithoatnan')) return <Footprints size={size} color={color} />;
  if (norm.includes('thangthoathiem') || norm.includes('thoathiem')) return <ArrowUpRight size={size} color={color} />;
  if (norm.includes('lanhnan')) return <MapPin size={size} color={color} />;

  // Giường / Đệm / Ga / Chăn / Gối
  if (norm.includes('giuong')) return <BedDouble size={size} color={color} />;
  if (norm.includes('dem') || norm.includes('ga') || norm.includes('chan') || norm.includes('goi')) return <Bed size={size} color={color} />;

  // Tủ quần áo / Tủ giày
  if (norm.includes('tuquanao') || norm.includes('tuao')) return <Shirt size={size} color={color} />;
  if (norm.includes('tugiay') || norm.includes('giay')) return <Footprints size={size} color={color} />;

  // Bàn ghế / Sofa / Bàn trà / Bàn ăn
  if (norm.includes('sofa')) return <Armchair size={size} color={color} />;
  if (norm.includes('bantra') || norm.includes('cafe')) return <Coffee size={size} color={color} />;
  if (norm.includes('banan') || norm.includes('banghe') || norm.includes('ban')) return <UtensilsCrossed size={size} color={color} />;

  // TV / Kệ TV
  if (norm.includes('tv') || norm.includes('tivi')) return <Tv size={size} color={color} />;

  // Rèm cửa
  if (norm.includes('rem')) return <Blinds size={size} color={color} />;

  // Gương
  if (norm.includes('guong')) return <Sparkle size={size} color={color} />;

  // Điều hòa
  if (norm.includes('dieuhoa')) return <Wind size={size} color={color} />;

  // Nóng lạnh
  if (norm.includes('nonglanh')) return <Droplets size={size} color={color} />;

  // Tủ lạnh
  if (norm.includes('tulanh')) return <Refrigerator size={size} color={color} />;

  // Quạt
  if (norm.includes('quat')) return <Fan size={size} color={color} />;

  // Hút mùi
  if (norm.includes('hutmui')) return <AirVent size={size} color={color} />;

  // Lò vi sóng
  if (norm.includes('lovisong') || norm.includes('visong')) return <Microwave size={size} color={color} />;

  // Máy rửa bát
  if (norm.includes('ruabat')) return <Utensils size={size} color={color} />;

  // Bếp từ / Tủ bếp / Chậu rửa / Khu bếp
  if (norm.includes('bep') || norm.includes('chaurua')) return <ChefHat size={size} color={color} />;

  // Nhà vệ sinh
  if (norm.includes('nhavesinh') || norm.includes('vesinh') || norm.includes('wc') || norm.includes('toilet')) return <Bath size={size} color={color} />;

  // Ban công / Logia
  if (norm.includes('bancong') || norm.includes('logia')) return <Trees size={size} color={color} />;

  // Cửa sổ
  if (norm.includes('cuaso')) return <AppWindow size={size} color={color} />;

  // Gác lửng
  if (norm.includes('gaclung') || norm.includes('gac')) return <Layers size={size} color={color} />;

  // Phòng khách / Phòng ngủ
  if (norm.includes('phongkhach') || norm.includes('phongngu') || norm.includes('phong')) return <Home size={size} color={color} />;

  // Nuôi thú cưng / Pet
  if (norm.includes('pet') || norm.includes('thucung')) return <HeartPulse size={size} color={color} />;

  // Công tơ điện / Đồng hồ nước
  if (norm.includes('dien')) return <Zap size={size} color={color} />;
  if (norm.includes('nuoc')) return <Gauge size={size} color={color} />;

  // Mặc định
  return <Check size={size} color={color} />;
};

