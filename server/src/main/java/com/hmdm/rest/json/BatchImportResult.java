package com.hmdm.rest.json;

import java.util.ArrayList;
import java.util.List;

public class BatchImportResult {

    private int totalRows;
    private int successCount;
    private int failedCount;

    private List<BatchImportRowResult> rows = new ArrayList<>();

    public List<BatchImportRowResult> getRows() {
        return rows;
    }

    public void setTotalRows(int size) {
        this.totalRows = size;
    }

    public void setSuccessCount(int count) {
        this.successCount = count;
    }

    public void setFailedCount(int count) {
        this.failedCount = count;
    }

    public int getFailedCount() {
        return failedCount;
    }

    public int getSuccessCount() {
        return successCount;
    }

    public int getTotalRows() {
        return totalRows;
    }
}