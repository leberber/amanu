from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.core.config import settings


def get_mail_config() -> ConnectionConfig:
    """Get email configuration"""
    return ConnectionConfig(
        MAIL_USERNAME=settings.MAIL_USERNAME,
        MAIL_PASSWORD=settings.MAIL_PASSWORD,
        MAIL_FROM=settings.MAIL_FROM,
        MAIL_PORT=settings.MAIL_PORT,
        MAIL_SERVER=settings.MAIL_SERVER,
        MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=False,  # Disable cert validation to avoid SSL issues
    )


async def send_password_reset_email(email: str, code: str) -> bool:
    """Send password reset email with 6-digit code"""
    try:
        conf = get_mail_config()

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <div style="text-align: center; margin-bottom: 32px;">
                        <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #2E6CB7 0%, #0F3C82 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 28px; color: white;">🔐</span>
                        </div>
                        <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">Password Reset</h1>
                    </div>

                    <!-- Content -->
                    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                        You requested to reset your password. Use the code below to reset it.
                    </p>

                    <!-- Code Box -->
                    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
                        <div style="font-size: 36px; font-weight: 700; color: #0F3C82; letter-spacing: 8px; font-family: monospace;">
                            {code}
                        </div>
                    </div>

                    <!-- Warning -->
                    <p style="color: #999; font-size: 14px; line-height: 1.5; text-align: center; margin-bottom: 0;">
                        This code will expire in <strong>15 minutes</strong>.<br>
                        If you didn't request this, please ignore this email.
                    </p>
                </div>

                <!-- Footer -->
                <div style="text-align: center; margin-top: 24px;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                        &copy; 2025 Elsuq. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message = MessageSchema(
            subject="Password Reset Code - Elsuq",
            recipients=[email],
            body=html_content,
            subtype=MessageType.html,
        )

        fm = FastMail(conf)
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False


async def send_email_verification_email(email: str, code: str) -> bool:
    """Send email verification code for registration"""
    try:
        conf = get_mail_config()

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
            <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
                <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <div style="text-align: center; margin-bottom: 32px;">
                        <div style="width: 64px; height: 64px; background: linear-gradient(135deg, #2E6CB7 0%, #0F3C82 100%); border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center;">
                            <span style="font-size: 28px; color: white;">✉️</span>
                        </div>
                        <h1 style="margin: 0; color: #1a1a1a; font-size: 24px; font-weight: 700;">Verify Your Email</h1>
                    </div>

                    <!-- Content -->
                    <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 24px; text-align: center;">
                        Welcome to Elsuq! Please use the code below to verify your email address.
                    </p>

                    <!-- Code Box -->
                    <div style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                        <p style="margin: 0 0 8px 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
                        <div style="font-size: 36px; font-weight: 700; color: #0F3C82; letter-spacing: 8px; font-family: monospace;">
                            {code}
                        </div>
                    </div>

                    <!-- Warning -->
                    <p style="color: #999; font-size: 14px; line-height: 1.5; text-align: center; margin-bottom: 0;">
                        This code will expire in <strong>15 minutes</strong>.<br>
                        If you didn't create an account, please ignore this email.
                    </p>
                </div>

                <!-- Footer -->
                <div style="text-align: center; margin-top: 24px;">
                    <p style="color: #999; font-size: 12px; margin: 0;">
                        &copy; 2025 Elsuq. All rights reserved.
                    </p>
                </div>
            </div>
        </body>
        </html>
        """

        message = MessageSchema(
            subject="Verify Your Email - Elsuq",
            recipients=[email],
            body=html_content,
            subtype=MessageType.html,
        )

        fm = FastMail(conf)
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Failed to send verification email: {e}")
        return False
