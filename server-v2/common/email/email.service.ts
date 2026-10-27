import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer from 'nodemailer';

type BookingNotification = {
  booking: Record<string, any>;
  building?: Record<string, any> | null;
};

@Injectable()
export class EmailService {
  private readonly adminEmail =
    process.env.EMAIL_ADMIN_TO ||
    'mkt.tinyhouses@gmail.com';

  private readonly smtpUser =
    process.env.EMAIL_SMTP_USER ||
    process.env.EMAIL_FROM ||
    '';

  private readonly smtpPass =
    process.env.EMAIL_SMTP_PASS ||
    process.env.EMAIL_PASS ||
    '';

  private readonly transporter =
    nodemailer.createTransport({
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
      host:
        process.env.EMAIL_SMTP_HOST ||
        'smtp.gmail.com',
      port: Number(
        process.env.EMAIL_SMTP_PORT ||
          587,
      ),
      secure:
        Number(
          process.env.EMAIL_SMTP_PORT ||
            587,
        ) === 465,
      requireTLS: true,
      auth:
        this.smtpUser &&
        this.smtpPass
          ? {
              user: this.smtpUser,
              pass: this.smtpPass,
            }
          : undefined,
    });

  assertRecoveryEmailConfigured() {
    if (!this.smtpUser || !this.smtpPass) {
      throw new ServiceUnavailableException({
        success: false,
        error: 'Chức năng khôi phục mật khẩu chưa sẵn sàng. Vui lòng thử lại sau hoặc liên hệ quản trị viên.',
      });
    }
  }

  /** Recovery messages must use real delivery, never the booking simulation. */
  async sendPasswordRecoveryEmail(to: string, text: string) {
    this.assertRecoveryEmailConfigured();
    await this.transporter.sendMail({
      from: { name: 'Homelax', address: this.smtpUser },
      to,
      subject: '[Homelax] Khôi phục mật khẩu',
      text,
    });
  }

  async sendVerificationEmail(to: string, text: string) {
    this.assertRecoveryEmailConfigured();
    await this.transporter.sendMail({
      from: { name: 'Homelax', address: this.smtpUser },
      to,
      subject: '[Homelax] Xác thực email',
      text,
    });
  }

  async sendBookingNotificationToAdmin({
    booking,
    building,
  }: BookingNotification) {
    const buildingCode =
      booking.buildingCode ||
      building?.code ||
      '';

    const rawRoom =
      booking.roomNumber || '';

    const roomName = rawRoom
      ? /^(Phòng|Studio|Căn)/i.test(
          String(rawRoom),
        )
        ? String(rawRoom)
        : `Phòng ${rawRoom}`
      : 'Phòng Studio';

    const customerName =
      booking.customerName ||
      'Khách hàng';

    const appointmentDate =
      booking.appointmentDate ||
      new Date()
        .toISOString()
        .split('T')[0];

    const appointmentTime =
      booking.appointmentTime ||
      '10:00';

    const phone = String(
      booking.phone || '',
    ).trim();

    const subject =
      `[Homelax] Lịch xem phòng mới: ${buildingCode || 'Tòa nhà'} - ${roomName} (${customerName})`;

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#0f172a">
        <h2 style="margin:0 0 16px;color:#d97706">Homelax - Lịch xem phòng mới</h2>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:8px 0;color:#64748b">Mã lịch hẹn</td><td><strong>${booking.id || ''}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Khách hàng</td><td><strong>${customerName}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Điện thoại</td><td><strong>${phone}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Email</td><td>${booking.email || 'Chưa cung cấp'}</td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Tòa nhà</td><td><strong>${buildingCode || 'Chưa xác định'}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Phòng</td><td><strong>${roomName}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#64748b">Thời gian</td><td><strong>${appointmentTime} - ${appointmentDate}</strong></td></tr>
        </table>
        <p style="margin-top:18px;padding:12px;background:#fffbeb;border:1px solid #fcd34d">
          Vui lòng liên hệ khách hàng để xác nhận lịch xem phòng.
        </p>
      </div>
    `;

    if (!this.smtpPass) {
      console.log(
        `[EmailService] SMTP password not configured; booking notification simulated for ${this.adminEmail}`,
      );

      return {
        success: true,
        simulated: true,
      };
    }

    const info =
      await this.transporter.sendMail({
        from:
          this.smtpUser
            ? `"Homelax System" <${this.smtpUser}>`
            : undefined,
        to: this.adminEmail,
        subject,
        html,
      });

    return {
      success: true,
      messageId: info.messageId,
    };
  }
}
