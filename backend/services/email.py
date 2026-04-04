"""
Shared email helper using aiosmtplib (Hostinger SMTP / SSL on port 465).
Call send_email() from any service that needs to dispatch transactional email.
"""
from __future__ import annotations

import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

import aiosmtplib

from config import settings

logger = logging.getLogger(__name__)


def build_email_html(
    *,
    title: str,
    body_html: str,
    cta_label: Optional[str] = None,
    cta_url: Optional[str] = None,
) -> str:
    """Compile a branded weCapture4U email to responsive HTML using MJML."""
    import mjml

    cta_section = ""
    if cta_label and cta_url:
        cta_section = f"""
      <mj-section background-color="#ffffff" padding="8px 0 24px">
        <mj-column>
          <mj-button
            href="{cta_url}"
            background-color="#4d79ff"
            color="#ffffff"
            font-size="15px"
            font-weight="700"
            border-radius="10px"
            inner-padding="14px 32px"
            font-family="Arial, sans-serif"
          >
            {cta_label}
          </mj-button>
        </mj-column>
      </mj-section>"""

    template = f"""
<mjml>
  <mj-head>
    <mj-attributes>
      <mj-all font-family="Arial, sans-serif" />
      <mj-text font-size="14px" line-height="1.7" color="#445566" />
    </mj-attributes>
    <mj-style>
      a {{ color: #4d79ff; text-decoration: none; }}
    </mj-style>
  </mj-head>
  <mj-body background-color="#f8f9ff">

    <!-- Logo header -->
    <mj-section padding="32px 0 16px">
      <mj-column>
        <mj-image
          src="https://wecapture4u.com/logo.png"
          alt="weCapture4U"
          width="160px"
          align="center"
        />
      </mj-column>
    </mj-section>

    <!-- Card: title -->
    <mj-section
      background-color="#ffffff"
      border-radius="20px 20px 0 0"
      padding="32px 40px 20px"
      css-class="card-top"
    >
      <mj-column>
        <mj-text
          font-size="20px"
          font-weight="700"
          color="#0a0e2e"
          letter-spacing="-0.02em"
          padding-bottom="20px"
          border-bottom="1px solid #e0e8ff"
        >
          {title}
        </mj-text>
      </mj-column>
    </mj-section>

    <!-- Card: body -->
    <mj-section
      background-color="#ffffff"
      padding="20px 40px 8px"
    >
      <mj-column>
        <mj-text>{body_html}</mj-text>
      </mj-column>
    </mj-section>

    {cta_section}

    <!-- Card: bottom rounding spacer -->
    <mj-section
      background-color="#ffffff"
      border-radius="0 0 20px 20px"
      padding="0 40px 32px"
    >
      <mj-column>
        <mj-text font-size="1px" color="#ffffff"> </mj-text>
      </mj-column>
    </mj-section>

    <!-- Footer -->
    <mj-section padding="20px 0 32px">
      <mj-column>
        <mj-text
          align="center"
          font-size="12px"
          color="#778899"
          line-height="1.6"
        >
          © weCapture4U &nbsp;·&nbsp; Photography Studio, Ireland
        </mj-text>
      </mj-column>
    </mj-section>

  </mj-body>
</mjml>"""

    result = mjml.mjml_to_html(template)
    if result.errors:
        logger.warning("MJML compilation warnings: %s", result.errors)
    return result.html


async def send_email(
    *,
    to: str,
    subject: str,
    html: str,
    from_email: Optional[str] = None,
) -> None:
    """Send a transactional email via Hostinger SMTP (SSL, port 465).

    Raises on SMTP error — callers should catch and handle as appropriate.
    Never swallow exceptions here; let callers decide whether to log-and-continue.
    """
    sender = from_email or settings.SMTP_FROM_EMAIL

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = sender
    message["To"] = to
    message.attach(MIMEText(html, "html"))

    await aiosmtplib.send(
        message,
        hostname=settings.SMTP_HOST,
        port=settings.SMTP_PORT,
        username=settings.SMTP_USER,
        password=settings.SMTP_PASSWORD,
        use_tls=True,
    )
    logger.debug("Email sent to %s — subject: %s", to, subject)
