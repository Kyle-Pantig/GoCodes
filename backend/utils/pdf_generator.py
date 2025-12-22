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
        # Use Legal size (wider than A4) in Landscape for maximum width
        # A4 Landscape: 297mm wide, Legal Landscape: 356mm wide
        super().__init__(orientation='L', format='Legal')
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

    def _get_text_height(self, text: str, width: float, font_size: int = 7) -> float:
        """Calculate required height for text in a cell with wrapping"""
        self.set_font('Helvetica', '', font_size)
        # Get string width and calculate lines needed
        if not text:
            return 5
        text_width = self.get_string_width(text)
        if text_width <= width - 2:  # -2 for padding
            return 5
        # Estimate lines needed
        lines = int(text_width / (width - 2)) + 1
        return max(5, lines * 4)

    def _calculate_row_height(self, row: List[str], col_widths: List[int]) -> float:
        """Calculate the maximum height needed for a row"""
        max_height = 5
        for i, cell in enumerate(row):
            w = col_widths[i] if i < len(col_widths) else col_widths[-1]
            text = str(cell) if cell is not None else ''
            height = self._get_text_height(text, w)
            max_height = max(max_height, height)
        return max_height
        
    def add_table(self, headers: List[str], rows: List[List[str]], col_widths: Optional[List[int]] = None):
        """Add a table to the PDF with text wrapping support"""
        if not headers or not rows:
            return
            
        # Calculate column widths based on content if not provided
        page_width = self.w - 2 * self.l_margin
        num_cols = len(headers)
        
        if col_widths is None:
            # Smart column width calculation based on header names and content
            col_widths = self._calculate_smart_widths(headers, rows, page_width)
        else:
            # Ensure widths fit page
            total = sum(col_widths)
            if total > page_width:
                ratio = page_width / total
                col_widths = [int(w * ratio) for w in col_widths]
        
        # Header row
        self._draw_header_row(headers, col_widths)
        
        # Data rows
        self.set_font('Helvetica', '', 7)
        self.set_text_color(51, 51, 51)
        row_fill = False
        
        for row in rows:
            # Calculate row height based on content
            row_height = self._calculate_row_height(row, col_widths)
            
            # Check if we need a new page
            if self.get_y() + row_height > self.h - 20:
                self.add_page()
                self._draw_header_row(headers, col_widths)
                self.set_font('Helvetica', '', 7)
                self.set_text_color(51, 51, 51)
                
            if row_fill:
                self.set_fill_color(248, 248, 248)
            else:
                self.set_fill_color(255, 255, 255)
            
            # Draw cells with proper wrapping
            start_x = self.get_x()
            start_y = self.get_y()
            
            for i, cell in enumerate(row):
                w = col_widths[i] if i < len(col_widths) else col_widths[-1]
                text = str(cell) if cell is not None else ''
                
                # Draw cell border and fill
                self.set_xy(start_x + sum(col_widths[:i]), start_y)
                self.cell(w, row_height, '', border=1, fill=True)
                
                # Draw text with wrapping
                self.set_xy(start_x + sum(col_widths[:i]) + 1, start_y + 1)
                self.multi_cell(w - 2, 4, text, border=0, align='L')
            
            self.set_xy(start_x, start_y + row_height)
            row_fill = not row_fill

    def _draw_header_row(self, headers: List[str], col_widths: List[int]):
        """Draw the header row"""
        self.set_font('Helvetica', 'B', 8)
        self.set_fill_color(102, 126, 234)
        self.set_text_color(255, 255, 255)
        for i, header in enumerate(headers):
            w = col_widths[i] if i < len(col_widths) else col_widths[-1]
            self.cell(w, 7, str(header), border=1, fill=True, align='C')
        self.ln()
        
    def _calculate_smart_widths(self, headers: List[str], rows: List[List[str]], page_width: float) -> List[int]:
        """Calculate smart column widths based on content"""
        num_cols = len(headers)
        
        # Define minimum and maximum widths
        min_width = 15
        max_width = 60
        
        # Calculate widths based on header length and sample content
        widths = []
        for i, header in enumerate(headers):
            header_lower = header.lower()
            
            # Assign widths based on column type
            if 'id' in header_lower and 'tag' not in header_lower:
                widths.append(20)
            elif 'tag' in header_lower:
                widths.append(35)
            elif 'date' in header_lower:
                widths.append(25)
            elif 'status' in header_lower:
                widths.append(22)
            elif 'cost' in header_lower or 'value' in header_lower or 'price' in header_lower:
                widths.append(28)
            elif '%' in header_lower or 'percent' in header_lower:
                widths.append(22)
            elif 'count' in header_lower:
                widths.append(22)
            elif 'description' in header_lower or 'notes' in header_lower:
                widths.append(55)
            elif 'category' in header_lower:
                widths.append(35)
            elif 'location' in header_lower or 'site' in header_lower:
                widths.append(30)
            elif 'department' in header_lower:
                widths.append(32)
            elif 'name' in header_lower or 'employee' in header_lower:
                widths.append(35)
            elif 'metric' in header_lower:
                widths.append(40)
            else:
                # Default based on header length
                widths.append(max(min_width, min(max_width, len(header) * 3 + 10)))
        
        # Scale to fit page width
        total = sum(widths)
        if total > page_width:
            ratio = page_width / total
            widths = [max(min_width, int(w * ratio)) for w in widths]
        elif total < page_width * 0.9:
            # Expand to use more space
            ratio = (page_width * 0.95) / total
            widths = [int(w * ratio) for w in widths]
            
        return widths


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

