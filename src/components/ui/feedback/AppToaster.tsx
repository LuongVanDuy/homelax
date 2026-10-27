import { Toaster } from 'sonner';
import { designTokens } from '../../../app/theme/tokens';

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      theme="light"
      richColors
      closeButton
      duration={4500}
      visibleToasts={3}
      offset={24}
      mobileOffset={16}
      containerAriaLabel="Thông báo"
      toastOptions={{
        closeButtonAriaLabel: 'Đóng thông báo',
        style: {
          fontFamily: designTokens.typography.fontFamily,
          fontSize: 14,
          borderRadius: designTokens.radius.md,
          boxShadow: designTokens.shadows.md,
        },
      }}
    />
  );
}
