export const blogDate=(value:string|null)=>value?new Date(value).toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}):'';
