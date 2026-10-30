'use client';

import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export interface ReportItem {
  date: string;
  employee_name: string;
  department: string;
  time_in: string;
  time_out: string;
  hours_worked: number;
  late_minutes: number;
  overtime_minutes: number;
  undertime_minutes: number;
  status: string;
  verification_method: string;
  location: string;
}

export function exportToCSV(data: ReportItem[], filename = 'attendance_report.csv') {
  const headers = [
    'Date',
    'Employee',
    'Department',
    'Time In',
    'Time Out',
    'Hours Worked',
    'Late (mins)',
    'Overtime (mins)',
    'Undertime (mins)',
    'Status',
    'Verification',
    'Location',
  ];

  const rows = data.map((d) => [
    d.date,
    `"${d.employee_name}"`,
    `"${d.department}"`,
    d.time_in,
    d.time_out,
    d.hours_worked,
    d.late_minutes,
    d.overtime_minutes,
    d.undertime_minutes,
    d.status,
    d.verification_method,
    `"${d.location}"`,
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToExcel(data: ReportItem[], filename = 'attendance_report.xlsx') {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map((d) => ({
      'Date': d.date,
      'Employee Name': d.employee_name,
      'Department': d.department,
      'Time In': d.time_in,
      'Time Out': d.time_out,
      'Hours Worked': d.hours_worked,
      'Late (mins)': d.late_minutes,
      'Overtime (mins)': d.overtime_minutes,
      'Undertime (mins)': d.undertime_minutes,
      'Status': d.status,
      'Verification Method': d.verification_method,
      'Location': d.location,
    }))
  );

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance');
  XLSX.writeFile(workbook, filename);
}

export function exportToPDF(data: ReportItem[], title = 'Attendance Report', filename = 'attendance_report.pdf') {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on ${format(new Date(), 'yyyy-MM-dd HH:mm')}`, 14, 22);

  const headers = [
    ['Date', 'Employee', 'Department', 'Time In', 'Time Out', 'Hours', 'Late', 'OT', 'Status', 'Verification', 'Location'],
  ];

  const body = data.map((d) => [
    d.date,
    d.employee_name,
    d.department,
    d.time_in,
    d.time_out,
    d.hours_worked.toFixed(1),
    d.late_minutes > 0 ? `${d.late_minutes}m` : '-',
    d.overtime_minutes > 0 ? `${d.overtime_minutes}m` : '-',
    d.status.toUpperCase(),
    d.verification_method,
    d.location,
  ]);

  autoTable(doc, {
    head: headers,
    body,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [30, 41, 59] },
  });

  doc.save(filename);
}

