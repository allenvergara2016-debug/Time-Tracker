'use client';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { EmployeeDTR } from '@/app/api/reports/dtr/route';
import { formatPHTime, getTimezoneLabel, DEFAULT_TIMEZONE } from '@/lib/ph-time';

/**
 * Generates an official Civil Service Form No. 48 / Daily Time Record PDF.
 * If multiple employees are provided, creates a multi-page PDF with 1 page per employee.
 * If 1 employee is provided, generates only that employee's DTR on 1 page.
 */
export function exportDTRListToPDF(
  dtrList: EmployeeDTR[],
  startDate: string,
  endDate: string,
  singleEmployeeName?: string,
  timezone: string = DEFAULT_TIMEZONE
) {
  if (!dtrList || dtrList.length === 0) return;

  const tz = timezone || DEFAULT_TIMEZONE;
  const tzLabel = getTimezoneLabel(tz);

  // Initialize jsPDF in portrait A4 (210 x 297 mm)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  dtrList.forEach((dtr, index) => {
    // Add page for subsequent employees
    if (index > 0) {
      doc.addPage();
    }

    // --- Header Section ---
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('CIVIL SERVICE FORM NO. 48 / STANDARD CORPORATE TIMESHEET', pageWidth / 2, 12, {
      align: 'center',
    });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text('DAILY TIME RECORD', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(30, 64, 175);
    doc.text(`Period Covered: ${dtr.period.formattedRange} • ${tzLabel}`, pageWidth / 2, 23, {
      align: 'center',
    });

    // Employee Meta Info Box
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(10, 26, pageWidth - 20, 16, 2, 2, 'FD');

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text('Employee Name:', 14, 32);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(dtr.employee.fullName, 42, 32);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Department:', 14, 38);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(dtr.employee.department || 'General', 42, 38);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Daily Rate:', 110, 32);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`PHP ${dtr.employee.dailyRate.toFixed(2)}`, 130, 32);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('OT Rate/Hr:', 110, 38);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`PHP ${dtr.employee.overtimeRatePerHour.toFixed(2)}/hr`, 130, 38);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text('Shift:', 160, 32);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(dtr.employee.shift || 'Regular', 170, 32);

    // --- Table Section ---
    const tableHead = [
      [
        { content: 'Day', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        { content: 'A.M.', colSpan: 2, styles: { halign: 'center' } },
        { content: 'P.M.', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Overtime', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Tardiness', colSpan: 2, styles: { halign: 'center' } },
        { content: 'Daily Pay', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
      ],
      [
        { content: 'Arrival', styles: { halign: 'center' } },
        { content: 'Departure', styles: { halign: 'center' } },
        { content: 'Arrival', styles: { halign: 'center' } },
        { content: 'Departure', styles: { halign: 'center' } },
        { content: 'Hours', styles: { halign: 'center' } },
        { content: 'OT Pay', styles: { halign: 'center' } },
        { content: 'Late', styles: { halign: 'center' } },
        { content: 'Under', styles: { halign: 'center' } },
      ],
    ];

    const tableBody = dtr.days.map((d) => {
      const isWeekend = d.dayOfWeek === 'Sun' || d.dayOfWeek === 'Sat';
      return [
        {
          content: `${d.day} (${d.dayOfWeek})`,
          styles: {
            fontStyle: isWeekend ? 'normal' : 'bold',
            textColor: isWeekend ? [148, 163, 184] : [30, 41, 59],
            fillColor: isWeekend ? [248, 250, 252] : [255, 255, 255],
            halign: 'center',
          },
        },
        {
          content: d.timeIn ? formatPHTime(d.timeIn).replace(/\u00A0/g, ' ') : '-',
          styles: { halign: 'center', font: 'courier' },
        },
        {
          content: d.breakStart ? formatPHTime(d.breakStart).replace(/\u00A0/g, ' ') : '-',
          styles: { halign: 'center', font: 'courier' },
        },
        {
          content: d.breakEnd ? formatPHTime(d.breakEnd).replace(/\u00A0/g, ' ') : '-',
          styles: { halign: 'center', font: 'courier' },
        },
        {
          content: d.timeOut ? formatPHTime(d.timeOut).replace(/\u00A0/g, ' ') : '-',
          styles: { halign: 'center', font: 'courier' },
        },
        {
          content: d.overtimeHours > 0 ? `${d.overtimeHours}h` : '-',
          styles: { halign: 'center', textColor: d.overtimeHours > 0 ? [180, 83, 9] : [148, 163, 184] },
        },
        {
          content: d.overtimePay > 0 ? `PHP ${d.overtimePay.toFixed(2)}` : '-',
          styles: { halign: 'right', font: 'courier', textColor: d.overtimePay > 0 ? [180, 83, 9] : [148, 163, 184] },
        },
        {
          content: d.lateMinutes > 0 ? `${d.lateMinutes}m` : '-',
          styles: { halign: 'center', textColor: d.lateMinutes > 0 ? [225, 29, 72] : [148, 163, 184] },
        },
        {
          content: d.undertimeMinutes > 0 ? `${d.undertimeMinutes}m` : '-',
          styles: { halign: 'center', textColor: d.undertimeMinutes > 0 ? [225, 29, 72] : [148, 163, 184] },
        },
        {
          content: d.totalDailyWage > 0 ? `PHP ${d.totalDailyWage.toFixed(2)}` : '-',
          styles: {
            halign: 'right',
            font: 'courier',
            fontStyle: 'bold',
            textColor: d.totalDailyWage > 0 ? [6, 95, 70] : [148, 163, 184],
            fillColor: [240, 253, 244],
          },
        },
      ];
    });

    const tableFoot = [
      [
        { content: 'TOTAL', styles: { fontStyle: 'bold', halign: 'center', fillColor: [241, 245, 249] } },
        {
          content: `Days: ${dtr.totals.daysWorked} | Reg: ${dtr.totals.totalRegularHours} hrs`,
          colSpan: 4,
          styles: { fontStyle: 'bold', halign: 'left', fillColor: [241, 245, 249] },
        },
        {
          content: `${dtr.totals.totalOvertimeHours}h`,
          styles: { fontStyle: 'bold', halign: 'center', textColor: [180, 83, 9], fillColor: [254, 243, 199] },
        },
        {
          content: `PHP ${dtr.totals.totalOvertimePay.toFixed(2)}`,
          styles: { fontStyle: 'bold', halign: 'right', font: 'courier', textColor: [180, 83, 9], fillColor: [254, 243, 199] },
        },
        {
          content: `${dtr.totals.totalLateMinutes}m`,
          styles: { fontStyle: 'bold', halign: 'center', textColor: [225, 29, 72], fillColor: [241, 245, 249] },
        },
        {
          content: `${dtr.totals.totalUndertimeMinutes}m`,
          styles: { fontStyle: 'bold', halign: 'center', textColor: [225, 29, 72], fillColor: [241, 245, 249] },
        },
        {
          content: `PHP ${dtr.totals.totalGrossPay.toFixed(2)}`,
          styles: { fontStyle: 'bold', halign: 'right', font: 'courier', textColor: [6, 95, 70], fillColor: [220, 252, 231] },
        },
      ],
    ];

    // Compute compact cell padding to ensure whole month + totals + signatures fit neatly on 1 A4 page
    const totalDays = dtr.days.length;
    const cellPadding = totalDays > 25 ? 0.75 : 1.2;
    const fontSize = totalDays > 25 ? 6.8 : 7.2;

    autoTable(doc, {
      head: tableHead as any,
      body: tableBody as any,
      foot: tableFoot as any,
      startY: 44,
      margin: { left: 10, right: 10 },
      styles: {
        fontSize,
        cellPadding,
        lineColor: [203, 213, 225],
        lineWidth: 0.1,
        textColor: [15, 23, 42],
      },
      headStyles: {
        fillColor: [30, 41, 59],
        textColor: [255, 255, 255],
        fontSize: fontSize + 0.4,
        fontStyle: 'bold',
      },
      footStyles: {
        fontSize: fontSize + 0.4,
      },
      theme: 'grid',
    });

    // Final Y coordinate after table
    const finalY = (doc as any).lastAutoTable?.finalY || 220;

    // --- Summary & Signature Section ---
    let summaryY = finalY + 4;
    if (summaryY > pageHeight - 45) {
      // If table reached bottom, ensure safe spacing
      summaryY = pageHeight - 42;
    }

    // Summary Box
    doc.setDrawColor(203, 213, 225);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(10, summaryY, pageWidth - 20, 14, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Basic Wage: PHP ${dtr.totals.totalRegularPay.toFixed(2)}`, 14, summaryY + 5.5);
    doc.text(`Overtime Pay: PHP ${dtr.totals.totalOvertimePay.toFixed(2)}`, 14, summaryY + 10.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(6, 95, 70);
    doc.text(
      `TOTAL WAGE TO BE GIVEN: PHP ${dtr.totals.totalGrossPay.toFixed(2)}`,
      pageWidth - 14,
      summaryY + 8.5,
      { align: 'right' }
    );

    // Certification Text
    const certY = summaryY + 18;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const certText =
      'I certify on my honor that the above is a true and correct report of the hours of work performed, record of which was made daily at the time of arrival and departure from office.';
    doc.text(certText, pageWidth / 2, certY, { align: 'center', maxWidth: pageWidth - 30 });

    // Signatures
    const sigY = certY + 12;

    // Employee Signature
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(0.3);
    doc.line(20, sigY, 85, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text(dtr.employee.fullName.toUpperCase(), 52.5, sigY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Employee Signature', 52.5, sigY + 6.5, { align: 'center' });

    // In-Charge Signature
    doc.line(pageWidth - 85, sigY, pageWidth - 20, sigY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('AUTHORIZED OFFICIAL / SUPERVISOR', pageWidth - 52.5, sigY + 3.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('In-Charge Signature & Verification', pageWidth - 52.5, sigY + 6.5, { align: 'center' });
  });

  // Filename formatting
  let filename = `DTR_Payroll_${startDate}_to_${endDate}.pdf`;
  if (singleEmployeeName) {
    const safeName = singleEmployeeName.replace(/[^a-zA-Z0-9]/g, '_');
    filename = `DTR_${safeName}_${startDate}_to_${endDate}.pdf`;
  } else if (dtrList.length === 1) {
    const safeName = dtrList[0].employee.fullName.replace(/[^a-zA-Z0-9]/g, '_');
    filename = `DTR_${safeName}_${startDate}_to_${endDate}.pdf`;
  } else {
    filename = `DTR_All_Employees_${startDate}_to_${endDate}.pdf`;
  }

  doc.save(filename);
}

