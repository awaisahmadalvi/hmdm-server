/*
 *
 * Headwind MDM: Open Source Android MDM Software
 * https://h-mdm.com
 *
 * Copyright (C) 2019 Headwind Solutions LLC (http://h-sms.com)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package com.hmdm.service;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import javax.inject.Singleton;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.HorizontalAlignment;
import org.apache.poi.ss.usermodel.VerticalAlignment;
import org.apache.poi.ss.util.CellRangeAddress;
import org.apache.poi.xssf.usermodel.XSSFCell;
import org.apache.poi.xssf.usermodel.XSSFCellStyle;
import org.apache.poi.xssf.usermodel.XSSFColor;
import org.apache.poi.xssf.usermodel.XSSFFont;
import org.apache.poi.xssf.usermodel.XSSFRow;
import org.apache.poi.xssf.usermodel.XSSFSheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hmdm.persistence.domain.Device;
import com.hmdm.rest.json.DeviceInfo;
import com.hmdm.rest.json.LookupItem;

import com.lowagie.text.Document;
import com.lowagie.text.Element;
import com.lowagie.text.Font;
import com.lowagie.text.FontFactory;
import com.lowagie.text.PageSize;
import com.lowagie.text.Paragraph;
import com.lowagie.text.Phrase;
import com.lowagie.text.pdf.PdfPCell;
import com.lowagie.text.pdf.PdfPTable;
import com.lowagie.text.pdf.PdfPageEventHelper;
import com.lowagie.text.pdf.PdfWriter;

/**
 * <p>
 * Generates a polished, shareable device report (Excel and PDF) for the
 * device list currently shown to the administrator. The set of columns in
 * the report is driven entirely by the caller (see {@link ReportColumnKey})
 * so it always mirrors whichever columns are currently visible on the
 * Devices screen (the "Visible columns" role settings) - including any
 * columns added there in the future.
 * </p>
 * <p>
 * Two columns shown on screen as computed status icons - application
 * installation status and configuration files status - are intentionally
 * NOT reproduced here. Reliably matching the on-screen logic would require
 * re-deriving per-app/per-file installation state, which risks silently
 * showing incorrect information in a report meant to be shared. Those two
 * columns are rendered with a clear placeholder instead.
 * </p>
 */
@Singleton
public class DeviceReportService {

    private static final Color ACCENT_COLOR = new Color(76, 120, 140);
    private static final Color ACCENT_COLOR_DARK = new Color(44, 74, 94);
    private static final Color ROW_STRIPE_COLOR = new Color(248, 250, 252);
    private static final Color MUTED_TEXT_COLOR = new Color(107, 122, 137);
    private static final Color BORDER_COLOR = new Color(230, 235, 241);

    private static final Color STATUS_ONLINE_COLOR = new Color(46, 139, 87);
    private static final Color STATUS_IDLE_COLOR = new Color(184, 134, 11);
    private static final Color STATUS_OFFLINE_COLOR = new Color(178, 34, 34);

    private static final String NOT_AVAILABLE = "—"; // em dash

    private final SimpleDateFormat dateFormat = new SimpleDateFormat("dd/MM/yyyy HH:mm");
    private final ObjectMapper objectMapper = new ObjectMapper();

    /**
     * <p>A single report column: its display header and how to compute its
     * value for a given device.</p>
     */
    private static class ReportColumn {
        final String header;
        final Function<Device, String> valueExtractor;
        final boolean isStatus;

        ReportColumn(String header, Function<Device, String> valueExtractor) {
            this(header, valueExtractor, false);
        }

        ReportColumn(String header, Function<Device, String> valueExtractor, boolean isStatus) {
            this.header = header;
            this.valueExtractor = valueExtractor;
            this.isStatus = isStatus;
        }
    }

    /**
     * <p>Builds the ordered list of report columns matching the requested
     * column keys, in the order requested. Unknown keys are ignored.</p>
     */
    private List<Map.Entry<String, ReportColumn>> resolveColumns(List<String> requestedKeys,
            String custom1Label, String custom2Label, String custom3Label) {
        Map<String, ReportColumn> registry = buildColumnRegistry(custom1Label, custom2Label, custom3Label);

        List<String> keys = (requestedKeys != null && !requestedKeys.isEmpty())
                ? requestedKeys
                : new ArrayList<>(registry.keySet());

        List<Map.Entry<String, ReportColumn>> result = new ArrayList<>();
        for (String key : keys) {
            ReportColumn column = registry.get(key);
            if (column != null) {
                result.add(new java.util.AbstractMap.SimpleEntry<>(key, column));
            }
        }
        return result;
    }

    private Map<String, ReportColumn> buildColumnRegistry(String custom1Label, String custom2Label,
            String custom3Label) {
        Map<String, ReportColumn> columns = new LinkedHashMap<>();

        columns.put("DeviceStatus", new ReportColumn("Status",
                device -> statusLabel(device.getStatusCode()), true));
        columns.put("DeviceDate", new ReportColumn("Last Update",
                device -> formatMillis(device.getLastUpdate())));
        columns.put("DeviceNumber", new ReportColumn("Device Number",
                device -> nullToEmpty(device.getNumber())));
        columns.put("DeviceImei", new ReportColumn("IMEI",
                device -> firstNonEmpty(device.getImei(), infoOf(device).map(DeviceInfo::getImei).orElse(null))));
        columns.put("DevicePhone", new ReportColumn("Phone",
                device -> firstNonEmpty(device.getPhone(), infoOf(device).map(DeviceInfo::getPhone).orElse(null))));
        columns.put("DeviceModel", new ReportColumn("Model",
                device -> infoOf(device).map(DeviceInfo::getModel).filter(s -> !s.isEmpty()).orElse("Unknown")));
        columns.put("DevicePermissionsStatus", new ReportColumn("Permissions",
                this::permissionsSummary));
        columns.put("DeviceAppInstallStatus", new ReportColumn("App Install Status",
                device -> NOT_AVAILABLE));
        columns.put("DeviceFilesStatus", new ReportColumn("Files Status",
                device -> NOT_AVAILABLE));
        columns.put("DeviceConfiguration", new ReportColumn("Configuration",
                device -> nullToEmpty(device.getConfigName())));
        columns.put("DeviceDesc", new ReportColumn("Description",
                device -> nullToEmpty(device.getDescription())));
        columns.put("DeviceGroup", new ReportColumn("Group(s)",
                this::groupNames));
        columns.put("LauncherVersion", new ReportColumn("Launcher Version",
                device -> nullToEmpty(device.getLauncherVersion())));
        columns.put("BatteryLevel", new ReportColumn("Battery Level",
                device -> infoOf(device).map(DeviceInfo::getBatteryLevel)
                        .map(level -> level + "%").orElse("")));
        columns.put("DefaultLauncher", new ReportColumn("Default Launcher",
                device -> infoOf(device).map(DeviceInfo::getDefaultLauncher)
                        .map(this::yesNo).orElse("")));
        columns.put("MdmMode", new ReportColumn("MDM Mode", device -> yesNo(device.getMdmMode())));
        columns.put("KioskMode", new ReportColumn("Kiosk Mode", device -> yesNo(device.getKioskMode())));
        columns.put("AndroidVersion", new ReportColumn("Android Version",
                device -> nullToEmpty(device.getAndroidVersion())));
        columns.put("EnrollmentDate", new ReportColumn("Enrollment Date",
                device -> formatMillis(device.getEnrollTime())));
        columns.put("Serial", new ReportColumn("Serial", device -> nullToEmpty(device.getSerial())));
        columns.put("Mac", new ReportColumn("MAC", device -> nullToEmpty(device.getMac())));
        columns.put("PublicIp", new ReportColumn("Public IP", device -> nullToEmpty(device.getPublicIp())));
        columns.put("Custom1", new ReportColumn(labelOrDefault(custom1Label, "Custom 1"),
                device -> nullToEmpty(device.getCustom1())));
        columns.put("Custom2", new ReportColumn(labelOrDefault(custom2Label, "Custom 2"),
                device -> nullToEmpty(device.getCustom2())));
        columns.put("Custom3", new ReportColumn(labelOrDefault(custom3Label, "Custom 3"),
                device -> nullToEmpty(device.getCustom3())));

        return columns;
    }

    public byte[] generateExcelReport(List<Device> devices, List<String> requestedColumns,
            String custom1Label, String custom2Label, String custom3Label,
            String filterSummary, String generatedBy) throws IOException {

        List<Map.Entry<String, ReportColumn>> columns = resolveColumns(requestedColumns, custom1Label,
                custom2Label, custom3Label);

        try (XSSFWorkbook workbook = new XSSFWorkbook();
                ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {

            XSSFSheet sheet = workbook.createSheet("Devices Report");

            XSSFCellStyle titleStyle = createTitleStyle(workbook);
            XSSFCellStyle subtitleStyle = createSubtitleStyle(workbook);
            XSSFCellStyle headerStyle = createHeaderStyle(workbook);
            XSSFCellStyle cellStyle = createCellStyle(workbook, false);
            XSSFCellStyle stripedCellStyle = createCellStyle(workbook, true);

            int lastColumn = Math.max(columns.size() - 1, 0);
            int rowIndex = 0;

            XSSFRow titleRow = sheet.createRow(rowIndex++);
            titleRow.setHeightInPoints(28);
            createCell(titleRow, 0, "Device Report", titleStyle);
            sheet.addMergedRegion(new CellRangeAddress(0, 0, 0, lastColumn));

            XSSFRow generatedRow = sheet.createRow(rowIndex++);
            createCell(generatedRow, 0, "Generated: " + dateFormat.format(new Date())
                    + (generatedBy != null ? "   |   By: " + generatedBy : ""), subtitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(1, 1, 0, lastColumn));

            XSSFRow filterRow = sheet.createRow(rowIndex++);
            createCell(filterRow, 0, "Filter: " + filterSummary, subtitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(2, 2, 0, lastColumn));

            XSSFRow countRow = sheet.createRow(rowIndex++);
            createCell(countRow, 0, "Total devices: " + devices.size(), subtitleStyle);
            sheet.addMergedRegion(new CellRangeAddress(3, 3, 0, lastColumn));

            rowIndex++; // spacer row

            int headerRowIndex = rowIndex;
            XSSFRow headerRow = sheet.createRow(rowIndex++);
            headerRow.setHeightInPoints(22);
            for (int i = 0; i < columns.size(); i++) {
                createCell(headerRow, i, columns.get(i).getValue().header, headerStyle);
            }

            for (int i = 0; i < devices.size(); i++) {
                Device device = devices.get(i);
                XSSFCellStyle rowStyle = (i % 2 == 0) ? cellStyle : stripedCellStyle;
                XSSFRow row = sheet.createRow(rowIndex++);

                for (int c = 0; c < columns.size(); c++) {
                    ReportColumn column = columns.get(c).getValue();
                    XSSFCell cell = createCell(row, c, column.valueExtractor.apply(device), rowStyle);
                    if (column.isStatus) {
                        XSSFFont font = workbook.createFont();
                        font.setBold(true);
                        font.setColor(new XSSFColor(statusColor(device.getStatusCode()), null));
                        XSSFCellStyle statusStyle = cloneStyleWithFont(workbook, rowStyle, font);
                        cell.setCellStyle(statusStyle);
                    }
                }
            }

            if (!columns.isEmpty()) {
                sheet.createFreezePane(0, headerRowIndex + 1);
            }

            for (int i = 0; i < columns.size(); i++) {
                sheet.autoSizeColumn(i);
                int width = sheet.getColumnWidth(i);
                sheet.setColumnWidth(i, Math.min(Math.max(width, 3000), 9000));
            }

            workbook.write(outputStream);
            return outputStream.toByteArray();
        }
    }

    public byte[] generatePdfReport(List<Device> devices, List<String> requestedColumns,
            String custom1Label, String custom2Label, String custom3Label,
            String filterSummary, String generatedBy) throws Exception {

        List<Map.Entry<String, ReportColumn>> columns = resolveColumns(requestedColumns, custom1Label,
                custom2Label, custom3Label);

        Document document = new Document(PageSize.A4.rotate(), 24, 24, 70, 40);
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();

        PdfWriter writer = PdfWriter.getInstance(document, outputStream);
        writer.setPageEvent(new ReportFooter());

        document.open();

        Font titleFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 20, new Color(255, 255, 255));
        Font subtitleFont = FontFactory.getFont(FontFactory.HELVETICA, 9, MUTED_TEXT_COLOR);
        Font headerFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD, 8.5f, Color.WHITE);
        Font cellFont = FontFactory.getFont(FontFactory.HELVETICA, 8, new Color(34, 48, 63));

        PdfPTable titleBar = new PdfPTable(1);
        titleBar.setWidthPercentage(100);
        PdfPCell titleCell = new PdfPCell(new Phrase("Device Report", titleFont));
        titleCell.setBackgroundColor(ACCENT_COLOR);
        titleCell.setBorder(0);
        titleCell.setPadding(12);
        titleBar.addCell(titleCell);
        document.add(titleBar);

        Paragraph spacer = new Paragraph(" ");
        spacer.setSpacingAfter(2);
        document.add(spacer);

        String generatedLine = "Generated: " + dateFormat.format(new Date())
                + (generatedBy != null ? "   |   By: " + generatedBy : "")
                + "   |   Total devices: " + devices.size();
        Paragraph generatedParagraph = new Paragraph(generatedLine, subtitleFont);
        generatedParagraph.setSpacingAfter(2);
        document.add(generatedParagraph);

        Paragraph filterParagraph = new Paragraph("Filter: " + filterSummary, subtitleFont);
        filterParagraph.setSpacingAfter(14);
        document.add(filterParagraph);

        if (columns.isEmpty()) {
            Paragraph none = new Paragraph("No columns are currently visible on the Devices screen to export.",
                    subtitleFont);
            document.add(none);
            document.close();
            return outputStream.toByteArray();
        }

        PdfPTable table = new PdfPTable(columns.size());
        table.setWidthPercentage(100);
        table.setHeaderRows(1);

        for (Map.Entry<String, ReportColumn> column : columns) {
            PdfPCell headerCell = new PdfPCell(new Phrase(column.getValue().header, headerFont));
            headerCell.setBackgroundColor(ACCENT_COLOR_DARK);
            headerCell.setPadding(6);
            headerCell.setHorizontalAlignment(Element.ALIGN_LEFT);
            headerCell.setBorderColor(ACCENT_COLOR_DARK);
            table.addCell(headerCell);
        }

        for (int i = 0; i < devices.size(); i++) {
            Device device = devices.get(i);
            Color rowColor = (i % 2 == 0) ? Color.WHITE : ROW_STRIPE_COLOR;

            for (Map.Entry<String, ReportColumn> column : columns) {
                ReportColumn col = column.getValue();
                if (col.isStatus) {
                    addStatusCell(table, device.getStatusCode(), cellFont, rowColor);
                } else {
                    addBodyCell(table, col.valueExtractor.apply(device), cellFont, rowColor);
                }
            }
        }

        if (devices.isEmpty()) {
            PdfPCell emptyCell = new PdfPCell(new Phrase("No devices match the selected filter.", cellFont));
            emptyCell.setColspan(columns.size());
            emptyCell.setPadding(10);
            emptyCell.setHorizontalAlignment(Element.ALIGN_CENTER);
            table.addCell(emptyCell);
        }

        document.add(table);
        document.close();

        return outputStream.toByteArray();
    }

    private void addBodyCell(PdfPTable table, String text, Font font, Color background) {
        PdfPCell cell = new PdfPCell(new Phrase(text, font));
        cell.setBackgroundColor(background);
        cell.setPadding(5);
        cell.setBorderColor(BORDER_COLOR);
        table.addCell(cell);
    }

    private void addStatusCell(PdfPTable table, String statusCode, Font baseFont, Color background) {
        Font statusFont = new Font(baseFont);
        statusFont.setColor(statusColor(statusCode));
        statusFont.setStyle(Font.BOLD);
        PdfPCell cell = new PdfPCell(new Phrase(statusLabel(statusCode), statusFont));
        cell.setBackgroundColor(background);
        cell.setPadding(5);
        cell.setBorderColor(BORDER_COLOR);
        table.addCell(cell);
    }

    private java.util.Optional<DeviceInfo> infoOf(Device device) {
        String rawInfo = device.getInfo();
        if (rawInfo == null || rawInfo.trim().isEmpty()) {
            return java.util.Optional.empty();
        }
        try {
            return java.util.Optional.of(objectMapper.readValue(rawInfo, DeviceInfo.class));
        } catch (Exception e) {
            return java.util.Optional.empty();
        }
    }

    private String permissionsSummary(Device device) {
        java.util.Optional<DeviceInfo> info = infoOf(device);
        if (!info.isPresent()) {
            return "";
        }
        DeviceInfo deviceInfo = info.get();
        if (Boolean.TRUE.equals(deviceInfo.getKioskMode())) {
            return "OK (Kiosk)";
        }
        List<Integer> permissions = deviceInfo.getPermissions();
        if (permissions == null || permissions.size() < 3) {
            return "Unknown";
        }
        int granted = permissions.get(0) + permissions.get(1) + permissions.get(2);
        if (granted == 0) {
            return "None granted";
        } else if (granted < 3) {
            return "Partial";
        } else {
            return "All granted";
        }
    }

    private static String statusLabel(String statusCode) {
        if (statusCode == null) {
            return "Unknown";
        }
        switch (statusCode) {
            case "green":
                return "Online";
            case "yellow":
                return "Idle";
            case "red":
                return "Offline";
            default:
                return "Unknown";
        }
    }

    private static Color statusColor(String statusCode) {
        if (statusCode == null) {
            return MUTED_TEXT_COLOR;
        }
        switch (statusCode) {
            case "green":
                return STATUS_ONLINE_COLOR;
            case "yellow":
                return STATUS_IDLE_COLOR;
            case "red":
                return STATUS_OFFLINE_COLOR;
            default:
                return MUTED_TEXT_COLOR;
        }
    }

    private String groupNames(Device device) {
        List<LookupItem> groups = device.getGroups();
        if (groups == null || groups.isEmpty()) {
            return "";
        }
        return groups.stream().map(LookupItem::getName).collect(Collectors.joining(", "));
    }

    private String formatMillis(Long millis) {
        if (millis == null || millis <= 0) {
            return "Unknown";
        }
        return dateFormat.format(new Date(millis));
    }

    private String yesNo(Boolean value) {
        if (value == null) {
            return "";
        }
        return value ? "Yes" : "No";
    }

    private static String firstNonEmpty(String a, String b) {
        if (a != null && !a.trim().isEmpty()) {
            return a;
        }
        return b != null ? b : "";
    }

    private static String nullToEmpty(String value) {
        return value != null ? value : "";
    }

    private static String labelOrDefault(String label, String fallback) {
        return (label != null && !label.trim().isEmpty()) ? label : fallback;
    }

    private XSSFCell createCell(XSSFRow row, int column, String value, XSSFCellStyle style) {
        XSSFCell cell = row.createCell(column);
        cell.setCellValue(value);
        cell.setCellStyle(style);
        return cell;
    }

    private XSSFCellStyle createTitleStyle(XSSFWorkbook workbook) {
        XSSFFont font = workbook.createFont();
        font.setBold(true);
        font.setFontHeightInPoints((short) 16);
        font.setColor(new XSSFColor(ACCENT_COLOR_DARK, null));

        XSSFCellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        return style;
    }

    private XSSFCellStyle createSubtitleStyle(XSSFWorkbook workbook) {
        XSSFFont font = workbook.createFont();
        font.setColor(new XSSFColor(MUTED_TEXT_COLOR, null));
        font.setFontHeightInPoints((short) 10);

        XSSFCellStyle style = workbook.createCellStyle();
        style.setFont(font);
        return style;
    }

    private XSSFCellStyle createHeaderStyle(XSSFWorkbook workbook) {
        XSSFFont font = workbook.createFont();
        font.setBold(true);
        font.setColor(new XSSFColor(Color.WHITE, null));

        XSSFCellStyle style = workbook.createCellStyle();
        style.setFont(font);
        style.setAlignment(HorizontalAlignment.LEFT);
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setFillForegroundColor(new XSSFColor(ACCENT_COLOR, null));
        style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        return style;
    }

    private XSSFCellStyle createCellStyle(XSSFWorkbook workbook, boolean striped) {
        XSSFCellStyle style = workbook.createCellStyle();
        style.setVerticalAlignment(VerticalAlignment.CENTER);
        style.setBorderTop(BorderStyle.THIN);
        style.setBorderBottom(BorderStyle.THIN);
        style.setTopBorderColor(new XSSFColor(BORDER_COLOR, null));
        style.setBottomBorderColor(new XSSFColor(BORDER_COLOR, null));
        if (striped) {
            style.setFillForegroundColor(new XSSFColor(ROW_STRIPE_COLOR, null));
            style.setFillPattern(FillPatternType.SOLID_FOREGROUND);
        }
        return style;
    }

    private XSSFCellStyle cloneStyleWithFont(XSSFWorkbook workbook, XSSFCellStyle base, XSSFFont font) {
        XSSFCellStyle style = workbook.createCellStyle();
        style.cloneStyleFrom(base);
        style.setFont(font);
        return style;
    }

    /**
     * Draws "Page X" in the bottom-right corner of every PDF page.
     */
    private static class ReportFooter extends PdfPageEventHelper {
        @Override
        public void onEndPage(PdfWriter writer, Document document) {
            Font footerFont = FontFactory.getFont(FontFactory.HELVETICA, 8, MUTED_TEXT_COLOR);
            Phrase footer = new Phrase("Page " + writer.getPageNumber(), footerFont);
            com.lowagie.text.pdf.ColumnText.showTextAligned(
                    writer.getDirectContent(),
                    Element.ALIGN_RIGHT,
                    footer,
                    document.right(),
                    document.bottom() - 20,
                    0);
        }
    }
}
