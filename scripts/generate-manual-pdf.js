const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');
const autoTable = require('jspdf-autotable').default || require('jspdf-autotable');

function generateExecutiveManualPDF() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210
  const pageHeight = doc.internal.pageSize.getHeight(); // 297
  const margin = 16;
  const contentWidth = pageWidth - margin * 2; // 178

  let currentY = 18;

  // Colors
  const cNavy = [15, 23, 42];      // #0f172a
  const cBlue = [37, 99, 235];     // #2563eb
  const cDarkSlate = [30, 41, 59]; // #1e293b
  const cSlate = [71, 85, 105];    // #475569
  const cLightSlate = [241, 245, 249]; // #f1f5f9
  const cBorder = [226, 232, 240]; // #e2e8f0
  const cEmerald = [16, 185, 129]; // #10b981
  const cAmber = [217, 119, 6];    // #d97706

  function checkPageBreak(neededHeight) {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 22;
      return true;
    }
    return false;
  }

  function renderSectionHeader(num, title) {
    checkPageBreak(16);
    doc.setFillColor(...cLightSlate);
    doc.roundedRect(margin, currentY, contentWidth, 8.5, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...cNavy);
    doc.text(`${num}. ${title.toUpperCase()}`, margin + 3.5, currentY + 5.8);
    currentY += 12;
  }

  function renderSubSectionHeader(title) {
    checkPageBreak(10);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...cBlue);
    doc.text(title, margin, currentY);
    currentY += 5;
  }

  function renderParagraph(text) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...cDarkSlate);
    const lines = doc.splitTextToSize(text, contentWidth);
    checkPageBreak(lines.length * 4.2 + 2);
    doc.text(lines, margin, currentY);
    currentY += lines.length * 4.2 + 3;
  }

  function renderBullet(title, desc) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...cNavy);
    const prefix = `•  ${title}: `;
    const prefixWidth = doc.getTextWidth(prefix);

    checkPageBreak(9);
    doc.text(prefix, margin + 2, currentY);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...cSlate);
    const remainingWidth = contentWidth - 4 - prefixWidth;
    const descLines = doc.splitTextToSize(desc, remainingWidth);

    doc.text(descLines[0], margin + 2 + prefixWidth, currentY);

    if (descLines.length > 1) {
      for (let i = 1; i < descLines.length; i++) {
        currentY += 4;
        checkPageBreak(5);
        doc.text(descLines[i], margin + 6, currentY);
      }
    }
    currentY += 5;
  }

  // ==========================================
  // COVER / TOP BANNER
  // ==========================================
  doc.setFillColor(...cNavy);
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Decorative blue line
  doc.setFillColor(...cBlue);
  doc.rect(0, 42, pageWidth, 2.5, 'F');

  // Title in Banner
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text('TIME TRACKER', margin, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(148, 163, 184);
  doc.text('ENTERPRISE WORKFORCE ATTENDANCE & DTR PLATFORM', margin, 24.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Executive Operations Manual & System Guide', margin, 34);

  currentY = 52;

  // Metadata Box
  doc.setFillColor(...cLightSlate);
  doc.setDrawColor(...cBorder);
  doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...cSlate);
  doc.text('TARGET AUDIENCE:', margin + 4, currentY + 6);
  doc.text('PREPARED FOR:', margin + 60, currentY + 6);
  doc.text('DOCUMENT VERSION:', margin + 115, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...cNavy);
  doc.text('Executive Leadership / HR Directorate', margin + 4, currentY + 11);
  doc.text('Internal Management Review', margin + 60, currentY + 11);
  doc.text('Version 2.4 (Production Release)', margin + 115, currentY + 11);

  doc.setFontSize(7);
  doc.setTextColor(...cSlate);
  doc.text('STATUS: Active Production • Cryptographically Enforced • White-Labeled Enterprise Solution', margin + 4, currentY + 16.5);

  currentY += 27;

  // ==========================================
  // SECTION 1: EXECUTIVE OVERVIEW
  // ==========================================
  renderSectionHeader(1, 'Executive Overview & Strategic Purpose');

  renderParagraph(
    'Time Tracker is an enterprise Progressive Web Application (PWA) designed to provide 100% verifiable workforce attendance tracking, automated Civil Service Form No. 48 Daily Time Records (DTR), and accurate payroll computations. It replaces legacy biometric hardware terminals and paper punch cards with a tamper-resistant mobile-first platform that functions seamlessly across iOS, Android, and Desktop workstations.'
  );

  renderParagraph(
    'The platform resolves core enterprise challenges: buddy punching, time theft, proxy attendance, and manual payroll calculation errors. By uniting hardware-bound biometric authentication with server-side geofencing and immutable rate logs, management gains complete confidence that every recorded hour represents physical presence and authorized work.'
  );

  // Key Strategic Benefits Grid Table
  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: cNavy, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 7.8, cellPadding: 2.2, textColor: cDarkSlate },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold' },
      1: { cellWidth: 136 },
    },
    head: [['Strategic Operational Pillar', 'Executive Value & Impact']],
    body: [
      ['Zero Buddy Punching', 'WebAuthn biometric confirmation on every tap ensures only the authorized employee can register attendance.'],
      ['Device Binding Protection', 'Locks user credentials to their physical device at enrollment, preventing login sharing or secondary phone taps.'],
      ['Server-Enforced Geofence', 'Server verifies coordinates using Haversine calculation against authorized office perimeter radii.'],
      ['Management-Set Wage Tiers', 'Daily wages and overtime rates are set by management per employee with immutable effective dates, protecting historical reports.'],
      ['Authoritative Server Time', 'Uses UTC server clock (timestamptz) only, completely nullifying phone clock tampering or timezone spoofing.'],
      ['White-Labeled Privacy', 'Zero third-party vendor watermarks; biometrics never leave the device enclave; no background GPS tracking.'],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // ==========================================
  // SECTION 2: ANTI-FRAUD & SECURITY PILLARS
  // ==========================================
  renderSectionHeader(2, 'Core Security & Anti-Fraud Architecture');

  renderSubSectionHeader('2.1 FIDO2 / WebAuthn Biometrics on Every Tap');
  renderParagraph(
    'Unlike standard software where biometrics are only checked at login, Time Tracker requires a biometric assertion (Touch ID, Face ID, or Android Fingerprint) for every tap event: Time In, Time Out, Break Start, and Break End. Single-use cryptographic challenges expire in 60 seconds. Biometric private keys never leave the phone hardware enclave.'
  );

  renderSubSectionHeader('2.2 Device Binding (Anti-Proxy Punching)');
  renderParagraph(
    'Device binding is established during passkey enrollment, linking the employee credential ID directly with their device hardware identifier. Requests from unrecognized devices or secondary phones are rejected. Management retains "Reset Device" and "Reset Passkey" capabilities in the Admin Directory.'
  );

  renderSubSectionHeader('2.3 Server-Side Geofence & Anti-Spoofing Filters');
  renderParagraph(
    'All coordinates are evaluated strictly on the backend. The system rejects GPS fixes with accuracy worse than the admin threshold (default: 50m) and automatically flags mock location apps (static coordinates with zero jitter) or impossible travel velocities exceeding 180 km/h between taps.'
  );

  renderSubSectionHeader('2.4 Offline Protection Policy');
  renderParagraph(
    'To guarantee timestamp and location integrity, attendance punches are strictly blocked when offline. If an employee loses internet connection, the system displays "No connection, cannot record attendance" and prevents any local queuing.'
  );

  // ==========================================
  // SECTION 3: MANAGEMENT & HR OPERATING GUIDE
  // ==========================================
  renderSectionHeader(3, 'Management & HR Directorate Operating Guide');

  renderSubSectionHeader('3.1 Real-Time Status Drilldown & Dashboard Monitoring');
  renderParagraph(
    'The administrator dashboard features 6 interactive KPI cards that open detailed inspection drilldowns upon clicking:'
  );

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: cDarkSlate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    styles: { fontSize: 7.2, cellPadding: 2, textColor: cDarkSlate },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold' },
      1: { cellWidth: 88 },
      2: { cellWidth: 64 },
    },
    head: [['Status Card', 'Monitored Workforce Metric', 'Immediate Manager Actions']],
    body: [
      ['PRESENT', 'Employees who clocked in on-time today with location name and tap timestamp.', 'Direct Chat, Profile Inspection'],
      ['LATE', 'Employees clocked in after shift start + grace period, with exact minutes late.', '1-Click WhatsApp, Send Email Notice'],
      ['TIMED OUT', 'Employees who finished shift, showing net hours worked and total break duration.', 'Review DTR Line, Audit Log'],
      ['ON LEAVE', 'Employees on approved Sick, Vacation, or Emergency Leave for the calendar day.', 'View Leave Duration & Reason'],
      ['ABSENT', 'Active employees with zero attendance records and no approved leave on file.', '1-Click WhatsApp & Email Follow-up'],
      ['FLAGGED', 'Suspicious scans: fallback PIN entries, GPS anomalies, or failed biometric scans.', 'Inspect Audit Diff, Dismiss/Investigate'],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 7;

  renderSubSectionHeader('3.2 Management-Set Rates & Immutable Rate History (FIX C)');
  renderBullet('Per-Employee Rates', 'Each employee has two management-configured values: Daily Wage Rate (regular_rate, ₱) and Hourly Overtime Rate (overtime_rate_per_hour, ₱/hr). Company-wide hardcoded multipliers are removed.');
  renderBullet('Rate History Tiers (employee_rates)', 'Modifying a wage inserts a new tier with an Effective Date. Past DTRs and payroll computations are never rewritten. Changing a wage today only applies to work dates from the effective date forward.');
  renderBullet('Bulk Rates CSV Import', 'Administrators can upload a CSV file with columns (employee, regular_rate, overtime_rate_per_hour, effective_from). A built-in validation preview checks all rows before committing.');
  renderBullet('Rate Privacy', 'Rates and gross pay are completely hidden from regular employee dashboards by default (show_rates_to_employees: false). Employees cannot view other colleagues\' wages.');
  renderBullet('Missing Rate Safeguard', 'If an employee has no rate configured, DTR payroll totals display "Rate not set" rather than defaulting to zero.');

  renderSubSectionHeader('3.3 DTR & Payroll Computation Rules');
  renderBullet('Standard Hours', 'Configurable daily work hours (default: 8.0). Hourly deduction rate = daily_wage / hours_per_day.');
  renderBullet('Pre- & Post-Shift Overtime', 'Overtime counts both before shift start (early clock-in) and after shift end (late clock-out).');
  renderBullet('Undertime Basis', 'Configurable between Exact per-minute deduction or 15-Minute Block rounding.');
  renderBullet('Overtime Approval', 'Overtime counts toward pay when approved (or approval disabled) after grace periods.');
  renderBullet('Overtime Rounding & Threshold', 'Configurable between Exact (per-minute), Full 30-Minute Blocks, or Full 1-Hour Blocks (e.g. employee must render at least 1 hour of overtime to qualify for OT payment).');

  renderSubSectionHeader('3.4 Safe Employee Removal & Retention Gates (FIX 5)');
  renderBullet('Deactivate / Archive', 'Default administrative action (is_active = false). Prevents login but preserves 100% of attendance, leave, and DTR records.');
  renderBullet('Permanent Delete', 'Restricted exclusively to Super Admins. Permitted only if the employee has zero attendance logs within the retention window (default: 3 years) and requires typing the employee\'s exact name.');

  renderSubSectionHeader('3.5 Immutable Audit Trail');
  renderParagraph(
    'Every wage modification, passkey reset, device unlink, leave approval, and setting change is logged to audit_logs with actor ID, timestamp, and a full JSON diff of old_value vs new_value.'
  );

  // ==========================================
  // SECTION 4: EMPLOYEE USER MANUAL
  // ==========================================
  renderSectionHeader(4, 'Employee User Guide & Daily Workflow');

  renderBullet('PWA Installation', 'Users can install the PWA on iPhone (Safari > Share > Add to Home Screen), Android (Chrome > Install App), or Desktop without downloading third-party store packages.');
  renderBullet('Mandatory First Login', 'Accounts are created with must_change_password: true. Employees are blocked from accessing the system until setting a secure 8+ character password (uppercase, lowercase, number).');
  renderBullet('Biometric Pairing', 'Employees register their fingerprint or Face ID during onboarding, binding their personal device to their account.');
  renderBullet('Daily Punches', 'Clocking in or out requires active internet and GPS. The employee taps Time In/Out, passes the native biometric prompt, and receives instant visual confirmation.');
  renderBullet('Leaves & Corrections', 'Employees submit leave requests and missed-tap correction forms with explanations directly from the dashboard.');
  renderBullet('Recovery Flow', 'If an employee gets a new phone, the app alerts "Device not recognized, contact your admin." Management resets the device in the directory, allowing re-enrollment.');

  // ==========================================
  // SECTION 5: REPORTING & FORM 48 STANDARDS
  // ==========================================
  renderSectionHeader(5, 'Reporting, DTR & Legal Labor Scope (FIX D)');

  renderParagraph(
    'All exported DTRs strictly follow Civil Service Form No. 48 conventions and are titled "Civil Service Form No. 48 / DTR with late, undertime, and overtime computation based on management-set rates". The platform avoids premature claims of automated statutory contributions (SSS, PhilHealth, Pag-IBIG) or complex night differential unless explicitly configured.'
  );

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: cNavy, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    styles: { fontSize: 7.2, cellPadding: 2, textColor: cDarkSlate },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 138 },
    },
    head: [['Export Format', 'Operational Application & Capabilities']],
    body: [
      ['Paginated PDF Document', 'Official Civil Service Form 48 format with clean page breaks per employee, signature lines, and verified computation formula breakdown.'],
      ['Excel Spreadsheet (.xlsx)', 'Multi-tab workbook containing raw punch logs, daily undertime/OT minutes, and management wage rates for payroll importing.'],
      ['Raw CSV Export', 'Lightweight data export compatible with ERPs, internal HRIS databases, and accounting software.'],
    ],
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // ==========================================
  // SECTION 6: EXECUTIVE & LEGAL ASSURANCE
  // ==========================================
  renderSectionHeader(6, 'Executive, Privacy & Legal Assurance');

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    theme: 'grid',
    headStyles: { fillColor: cDarkSlate, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    styles: { fontSize: 7.2, cellPadding: 2.2, textColor: cDarkSlate },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold' },
      1: { cellWidth: 134 },
    },
    head: [['Compliance Concern', 'System Safeguard & Technical Guarantee']],
    body: [
      ['Biometric Data Privacy', 'Biometrics never leave the employee phone enclave. The server only receives an encrypted public key assertion.'],
      ['Employee Location Privacy', 'No background or 24/7 tracking. GPS coordinates are requested strictly at the exact instant an employee taps a time button.'],
      ['Database Discretion', 'The application is completely white-labeled with zero third-party database badges or promotional marks.'],
      ['Audit Integrity', 'Immutable audit logs with JSON diffs protect both company management and employees against retroactive tampering.'],
    ],
  });

  // ==========================================
  // FOOTER & PAGE NUMBERING
  // ==========================================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Running Header (pages 2+)
    if (i > 1) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...cSlate);
      doc.text('TIME TRACKER — EXECUTIVE OPERATIONS MANUAL & SYSTEM GUIDE', margin, 10);
      doc.text('CONFIDENTIAL', pageWidth - margin, 10, { align: 'right' });
      doc.setDrawColor(...cBorder);
      doc.setLineWidth(0.3);
      doc.line(margin, 12, pageWidth - margin, 12);
    }

    // Running Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...cSlate);
    doc.setDrawColor(...cBorder);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

    doc.text('CONFIDENTIAL • FOR INTERNAL MANAGEMENT REVIEW ONLY', margin, pageHeight - 7.5);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 7.5, { align: 'right' });
  }

  // Save PDF to workspace and artifact directory
  const localPdfPath = path.join(__dirname, '..', 'Time_Tracker_Executive_Manual.pdf');
  const artifactPdfPath = 'C:\\Users\\franc\\.gemini\\antigravity\\brain\\373b596e-d43e-49e4-b01b-a7048ebf1005\\Time_Tracker_Executive_Manual.pdf';

  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(localPdfPath, pdfBuffer);
  fs.writeFileSync(artifactPdfPath, pdfBuffer);

  console.log('PDF successfully generated at:');
  console.log('1. Workspace:', localPdfPath);
  console.log('2. Artifact:', artifactPdfPath);
  console.log(`Total Pages: ${totalPages}`);
}

generateExecutiveManualPDF();

