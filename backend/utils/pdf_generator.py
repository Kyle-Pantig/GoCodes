"""
PDF generation utility for automated reports
"""
import io
from typing import Dict, Any, List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

try:
    from fpdf import FPDF
    PDF_AVAILABLE = True
except ImportError:
    FPDF = None
    PDF_AVAILABLE = False


class ReportPDF(FPDF):
    """Custom PDF class for report generation"""
    
    def __init__(self, report_name: str, report_type: str):
        super().__init__()
        self.report_name = report_name
        self.report_type = report_type
        self.set_auto_page_break(auto=True, margin=15)
        
    def header(self):
        """PDF Header"""
        self.set_font('Helvetica', 'B', 16)
        self.set_text_color(102, 126, 234)  # Purple color from email template
        self.cell(0, 10, self.report_name, new_x='LMARGIN', new_y='NEXT', align='C')
        self.set_font('Helvetica', '', 10)
        self.set_text_color(128, 128, 128)
        self.cell(0, 5, f'{self.report_type.title()} Report', new_x='LMARGIN', new_y='NEXT', align='C')
        self.cell(0, 5, f'Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}', new_x='LMARGIN', new_y='NEXT', align='C')
        self.ln(10)
        
    def footer(self):
        """PDF Footer"""
        self.set_y(-15)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, f'Page {self.page_no()}', align='C')

    def add_section_title(self, title: str):
        """Add a section title"""
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(51, 51, 51)
        self.set_fill_color(240, 240, 240)
        self.cell(0, 8, title, new_x='LMARGIN', new_y='NEXT', fill=True)
        self.ln(2)
        
    def add_summary_row(self, label: str, value: str):
        """Add a summary row with label and value"""
        self.set_font('Helvetica', '', 10)
        self.set_text_color(51, 51, 51)
        self.cell(90, 6, label, new_x='RIGHT')
        self.set_font('Helvetica', 'B', 10)
        self.cell(0, 6, str(value), new_x='LMARGIN', new_y='NEXT')
        
    def add_table(self, headers: List[str], rows: List[List[str]], col_widths: Optional[List[int]] = None):
        """Add a table to the PDF"""
        if not headers or not rows:
            return
            
        # Calculate column widths if not provided
        page_width = self.w - 2 * self.l_margin
        if col_widths is None:
            col_widths = [int(page_width / len(headers))] * len(headers)
        else:
            # Ensure widths fit page
            total = sum(col_widths)
            if total > page_width:
                ratio = page_width / total
                col_widths = [int(w * ratio) for w in col_widths]
        
        # Header row
        self.set_font('Helvetica', 'B', 9)
        self.set_fill_color(102, 126, 234)
        self.set_text_color(255, 255, 255)
        for i, header in enumerate(headers):
            w = col_widths[i] if i < len(col_widths) else col_widths[-1]
            self.cell(w, 7, str(header)[:20], border=1, fill=True, align='C')
        self.ln()
        
        # Data rows
        self.set_font('Helvetica', '', 8)
        self.set_text_color(51, 51, 51)
        row_fill = False
        for row in rows:
            # Check if we need a new page
            if self.get_y() > self.h - 25:
                self.add_page()
                # Re-add header row
                self.set_font('Helvetica', 'B', 9)
                self.set_fill_color(102, 126, 234)
                self.set_text_color(255, 255, 255)
                for i, header in enumerate(headers):
                    w = col_widths[i] if i < len(col_widths) else col_widths[-1]
                    self.cell(w, 7, str(header)[:20], border=1, fill=True, align='C')
                self.ln()
                self.set_font('Helvetica', '', 8)
                self.set_text_color(51, 51, 51)
                
            if row_fill:
                self.set_fill_color(248, 248, 248)
            else:
                self.set_fill_color(255, 255, 255)
                
            for i, cell in enumerate(row):
                w = col_widths[i] if i < len(col_widths) else col_widths[-1]
                # Truncate long text
                text = str(cell) if cell is not None else ''
                if len(text) > 25:
                    text = text[:22] + '...'
                self.cell(w, 6, text, border=1, fill=True)
            self.ln()
            row_fill = not row_fill


def generate_pdf_from_excel_data(
    excel_content: bytes,
    report_name: str,
    report_type: str
) -> Optional[bytes]:
    """
    Generate PDF from Excel data by parsing the Excel file and 
    recreating it as a formatted PDF.
    """
    if not PDF_AVAILABLE:
        logger.error("fpdf2 not available for PDF generation")
        return None
        
    try:
        from openpyxl import load_workbook
        
        # Load the Excel workbook from bytes
        wb = load_workbook(io.BytesIO(excel_content))
        
        # Create PDF
        pdf = ReportPDF(report_name, report_type)
        pdf.add_page()
        
        for sheet_name in wb.sheetnames:
            sheet = wb[sheet_name]
            
            # Add section for this sheet
            pdf.add_section_title(sheet_name)
            
            # Get all rows
            rows = list(sheet.iter_rows(values_only=True))
            if not rows:
                pdf.set_font('Helvetica', 'I', 10)
                pdf.cell(0, 6, 'No data available', new_x='LMARGIN', new_y='NEXT')
                pdf.ln(5)
                continue
                
            # First row is header
            headers = [str(h) if h else '' for h in rows[0]]
            data_rows = [[str(c) if c else '' for c in row] for row in rows[1:]]
            
            if headers and data_rows:
                pdf.add_table(headers, data_rows)
            elif headers and not data_rows:
                # Just show headers if no data
                pdf.set_font('Helvetica', 'I', 10)
                pdf.cell(0, 6, 'No records found', new_x='LMARGIN', new_y='NEXT')
                
            pdf.ln(10)
        
        # Return PDF content
        return bytes(pdf.output())
        
    except Exception as e:
        logger.error(f"Error generating PDF: {e}", exc_info=True)
        return None


def generate_simple_pdf(
    report_name: str,
    report_type: str,
    summary_data: Optional[Dict[str, Any]] = None,
    table_data: Optional[List[Dict[str, Any]]] = None
) -> Optional[bytes]:
    """
    Generate a simple PDF with summary and table data.
    Used when we have direct data instead of Excel content.
    """
    if not PDF_AVAILABLE:
        logger.error("fpdf2 not available for PDF generation")
        return None
        
    try:
        pdf = ReportPDF(report_name, report_type)
        pdf.add_page()
        
        # Add summary section if provided
        if summary_data:
            pdf.add_section_title('Summary')
            for key, value in summary_data.items():
                pdf.add_summary_row(key, str(value))
            pdf.ln(10)
        
        # Add table section if provided
        if table_data and len(table_data) > 0:
            pdf.add_section_title('Details')
            headers = list(table_data[0].keys())
            rows = [[str(row.get(h, '')) for h in headers] for row in table_data]
            pdf.add_table(headers, rows)
            
        return bytes(pdf.output())
        
    except Exception as e:
        logger.error(f"Error generating simple PDF: {e}", exc_info=True)
        return None


def is_pdf_available() -> bool:
    """Check if PDF generation is available"""
    return PDF_AVAILABLE

