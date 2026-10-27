import type { CSSProperties } from 'react';
import { publicSite } from '../public/publicSite';

type LogoProps = {
  size?: number;
  style?: CSSProperties;
  className?: string;
};

/** Original supplied 1920x1080 PNG, framed around its 1590x270 visible wordmark. */
export default function Logo({ size = 40, style, className }: LogoProps) {
  return <span className={className} style={{ width: size * 4, aspectRatio: '1590 / 270',
    position: 'relative', overflow: 'hidden', display: 'block', flexShrink: 0, ...style }}>
    <img src={publicSite.logo} alt={publicSite.name} width={1920} height={1080}
      style={{ position: 'absolute', width: '120.754717%', maxWidth: 'none', height: 'auto',
        left: '-10.377358%', top: '-150%', display: 'block' }} />
  </span>;
}
