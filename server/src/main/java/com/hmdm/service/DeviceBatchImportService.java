package com.hmdm.service;

import java.util.Collections;
import java.util.List;

import com.google.inject.Inject;
import com.google.inject.Singleton;
import com.hmdm.persistence.DeviceDAO;
import com.hmdm.persistence.domain.Device;
import com.hmdm.rest.json.BatchDevicePreviewRow;
import com.hmdm.rest.json.BatchImportResult;
import com.hmdm.rest.json.LookupItem;

@Singleton
public class DeviceBatchImportService {

    // private static final int DEFAULT_CUSTOMER_ID = 1;

    private final DeviceDAO deviceDAO;

    @Inject
    public DeviceBatchImportService(DeviceDAO deviceDAO) {
        this.deviceDAO = deviceDAO;
    }

    public BatchImportResult importDevices(List<BatchDevicePreviewRow> rows) {

        BatchImportResult result = new BatchImportResult();

        result.setTotalRows(rows.size());

        for (BatchDevicePreviewRow row : rows) {

            if (!row.isValid()) {
                result.setFailedCount(result.getFailedCount() + 1);
                result.getErrors().add(
                        "Row " + row.getRowNumber() + " is invalid.");
                continue;
            }

            try {

                Device existing = deviceDAO.getDeviceByNumber(row.getDeviceName());

                if (existing != null) {
                    result.setFailedCount(result.getFailedCount() + 1);
                    result.getErrors().add(
                            "Row "
                                    + row.getRowNumber()
                                    + ": Device already exists ("
                                    + row.getDeviceName()
                                    + ")");
                    continue;
                }

                Device device = new Device();

                // ------------------------------------
                // Required fields
                // ------------------------------------

                device.setNumber(row.getDeviceName());

                device.setConfigurationId(row.getConfigurationId());

                // Create a single item list instantly
                List<LookupItem> groups = Collections.singletonList(new LookupItem(row.getGroupId(), null));
                device.setGroups(groups);

                // ------------------------------------
                // Persist
                // ------------------------------------

                // device.setCustomerId(settings.getCustomerId());
                device.setLastUpdate(0L);

                deviceDAO.insertDevice(device);

                result.setSuccessCount(result.getSuccessCount() + 1);

            } catch (Exception ex) {

                result.setFailedCount(result.getFailedCount() + 1);

                result.getErrors().add(
                        "Row "
                                + row.getRowNumber()
                                + ": "
                                + ex.getMessage());

            }

        }

        return result;

    }
}