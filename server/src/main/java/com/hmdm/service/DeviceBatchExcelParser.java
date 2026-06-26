package com.hmdm.service;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

import javax.inject.Singleton;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import com.hmdm.rest.json.BatchDevicePreviewRow;

@Singleton
public class DeviceBatchExcelParser {

    private static final String SHEET_NAME = "Device Upload";

    public List<BatchDevicePreviewRow> parse(InputStream inputStream) throws Exception {
        List<BatchDevicePreviewRow> rows = new ArrayList<>();

        try (Workbook workbook = new XSSFWorkbook(inputStream)) {
            Sheet sheet = workbook.getSheet(SHEET_NAME);
            if (sheet == null) {
                throw new IllegalArgumentException("Sheet '" + SHEET_NAME + "' not found");
            }

            int lastRowNum = sheet.getLastRowNum();

            for (int i = 1; i <= lastRowNum; i++) { // skip header row 0
                Row row = sheet.getRow(i);
                if (isRowEmpty(row)) {
                    continue;
                }

                BatchDevicePreviewRow dto = new BatchDevicePreviewRow();
                dto.setRowNumber(i + 1); // Excel row number
                dto.setDeviceName(getCellString(row, 0));
                dto.setConfigurationValue(getCellString(row, 1));
                dto.setGroupValue(getCellString(row, 2));

                rows.add(dto);
            }
        }

        return rows;
    }

    private String getCellString(Row row, int cellIndex) {
        if (row == null) {
            return null;
        }

        Cell cell = row.getCell(cellIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) {
            return null;
        }

        DataFormatter formatter = new DataFormatter();
        String value = formatter.formatCellValue(cell);
        if (value != null) {
            value = value.trim();
        }

        return value == null || value.isEmpty() ? null : value;
    }

    private boolean isRowEmpty(Row row) {
        if (row == null) {
            return true;
        }

        for (int i = 0; i <= 2; i++) {
            String value = getCellString(row, i);
            if (value != null && !value.trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }
}