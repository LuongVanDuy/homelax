import { publicBrand } from '../../app/theme/publicBrand';
import { useId } from 'react';
import { Box, Link, Stack, Typography } from '@mui/material';
import { Mail, MapPin, Phone } from 'lucide-react';
import { PublicLink } from '../../app/router/PublicLink';
import { designTokens as tokens } from '../../app/theme/tokens';
import { footerLinkGroups, publicSite, publicSocialLinks } from './publicSite';
import Logo from '../brand/Logo';

const linkStyle = {
  display: 'inline-flex', alignItems: 'center', minHeight: 44, py: 0.75,
  color: tokens.colors.neutral[300], fontSize: '0.875rem', lineHeight: 1.6,
  textDecoration: 'none', overflowWrap: 'anywhere',
  '&:hover': { color: publicBrand.orange, textDecoration: 'underline', textUnderlineOffset: '4px' },
} as const;

export default function Footer({ flush = false }: { flush?: boolean }) {
  const id = useId();
  return (
    <Box component="footer" aria-label="Thông tin Homelax" sx={{
      bgcolor: tokens.colors.navy[900], color: tokens.colors.neutral[300],
      fontFamily: tokens.typography.fontFamily, mt: flush ? 0 : { xs: 5, md: 7 },
      '& a:focus-visible': { outline: `3px solid ${publicBrand.orange}`, outlineOffset: 3, borderRadius: 1 },
    }}>
      <Box sx={{ maxWidth: tokens.layout.publicContentMax, mx: 'auto', px: { xs: 2, sm: 3 }, pr: { xs: '88px', sm: 3 }, pt: { xs: 4, md: 6 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', lg: '1.6fr repeat(3, minmax(0, 1fr))' },
          columnGap: { xs: 3, lg: 4 }, rowGap: 3, pb: 4 }}>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Box component={PublicLink} to="/" aria-label="Homelax - Trang chủ" sx={{
              display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', minHeight: 56,
              bgcolor: tokens.colors.neutral[0], borderRadius: 1.5, px: 1.5, py: 1,
            }}><Logo size={40} /></Box>
            <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{publicSite.description}</Typography>
            <Box component="address" sx={{ fontStyle: 'normal', '& svg': { color: publicBrand.orange, flexShrink: 0 } }}>
              <Link href={`tel:${publicSite.phone}`} sx={{ ...linkStyle, gap: 1.25 }}><Phone size={18} aria-hidden="true" />{publicSite.phone}</Link>
              <Link href={`mailto:${publicSite.email}`} sx={{ ...linkStyle, display: 'flex', gap: 1.25 }}><Mail size={18} aria-hidden="true" />{publicSite.email}</Link>
              <Stack direction="row" spacing={1.25} sx={{ pt: 1, alignItems: 'flex-start' }}>
                <MapPin size={18} aria-hidden="true" style={{ marginTop: 3 }} />
                <Typography variant="body2" sx={{ lineHeight: 1.7 }}>{publicSite.address}</Typography>
              </Stack>
            </Box>
            <Box sx={{ borderTop: `1px solid ${tokens.colors.navy[700]}`, pt: 2, fontSize: '0.875rem', lineHeight: 1.8 }}>
              <Typography variant="body2" sx={{ color: tokens.colors.neutral[0], fontWeight: 600, mb: 0.75 }}>{publicSite.company}</Typography>
              <div>Người đại diện: {publicSite.representative}</div>
              <div>Mã số thuế: {publicSite.taxCode}</div>
              <div>Ngày cấp: {publicSite.issuedOn}</div>
              <Box component="nav" aria-label="Mạng xã hội Homelax" sx={{ mt: 1.5 }}>
                <Stack direction="row" useFlexGap sx={{ gap: 1, flexWrap: 'wrap' }}>
                  {publicSocialLinks.map(social => (
                    <Link key={social.id} href={social.href} target="_blank" rel="noopener noreferrer"
                      aria-label={`${social.label} Homelax (mở tab mới)`}
                      title={social.label}
                      sx={{ ...linkStyle, width: 32, height: 32, minHeight: 32, p: 0, justifyContent: 'center', borderRadius: 1.5, bgcolor: tokens.colors.navy[800],
                        '&:hover': { bgcolor: tokens.colors.navy[700] } }}>
                      <Box component="img" src={`/brands/${social.id}.svg`} alt="" aria-hidden="true" width={18} height={18}
                        sx={{ display: 'block', filter: 'brightness(0) invert(1)' }} />
                    </Link>
                  ))}
                </Stack>
              </Box>
            </Box>
          </Stack>

          {footerLinkGroups.map(group => (
            <Box component="nav" key={group.id} aria-labelledby={`${id}-${group.id}`} sx={{ minWidth: 0 }}>
              <Typography component="h2" id={`${id}-${group.id}`} sx={{ color: tokens.colors.neutral[0], fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 1.5 }}>{group.title}</Typography>
              <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {group.links.map(link => <Box component="li" key={link.to}><Link component={PublicLink} to={link.to} sx={linkStyle}>{link.label}</Link></Box>)}
              </Box>
            </Box>
          ))}

        </Box>

        <Box sx={{ borderTop: `1px solid ${tokens.colors.navy[700]}`, py: 2, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.875rem' }}>{publicSite.copyright}</Typography>
        </Box>
      </Box>
    </Box>
  );
}
