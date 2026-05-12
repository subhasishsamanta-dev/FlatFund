import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface ExportData {
    title: string;
    filename: string;
    columns: { header: string; dataKey: string }[];
    data: any[];
}

export const exportToExcel = ({ filename, data, columns }: ExportData) => {
    // Map data to column headers
    const worksheetData = data.map(item => {
        const row: any = {};
        columns.forEach(col => {
            row[col.header] = item[col.dataKey];
        });
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportToPDF = ({ title, filename, columns, data }: ExportData) => {
    try {
        const doc = new jsPDF();

        // Add Title
        doc.setFontSize(20);
        doc.setTextColor(13, 148, 136); // Teal primary color
        doc.text(title, 14, 22);

        // Add Generation Date
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);

        // Map columns for autotable
        const tableColumns = columns.map(col => col.header);
        const tableData = data.map(row => columns.map(col => row[col.dataKey] || ''));

        // Create Table using direct call
        autoTable(doc, {
            startY: 35,
            head: [tableColumns],
            body: tableData,
            theme: 'striped',
            headStyles: {
                fillColor: [13, 148, 136], // Teal
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: 'bold'
            },
            styles: {
                fontSize: 9,
                cellPadding: 3,
                font: 'helvetica'
            },
            alternateRowStyles: {
                fillColor: [245, 245, 245]
            },
            margin: { top: 35 }
        });

        doc.save(`${filename}.pdf`);
    } catch (error) {
        console.error("PDF Export failed:", error);
        alert("Failed to export PDF. Please check the console for more details.");
    }
};
