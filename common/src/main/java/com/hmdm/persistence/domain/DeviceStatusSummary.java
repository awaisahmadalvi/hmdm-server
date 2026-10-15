package com.hmdm.persistence.domain;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;

import java.io.Serializable;

/**
 * <p>Device counts for the Devices page summary tiles (Total / Online / Idle / Offline / Needs attention),
 * computed by a single aggregate query (DeviceMapper.getDeviceStatusSummary) instead of loading every device.</p>
 */
@ApiModel(description = "Device counts by status for the Devices page summary tiles")
public class DeviceStatusSummary implements Serializable {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty("Number of devices")
    private long total;

    @ApiModelProperty("Devices updated less than 2 hours ago")
    private long online;

    @ApiModelProperty("Devices updated 2 to 4 hours ago")
    private long idle;

    @ApiModelProperty("Devices updated 4 or more hours ago, or never")
    private long offline;

    @ApiModelProperty("Devices with a permissions, applications or files problem")
    private long needsAttention;

    public long getTotal() {
        return total;
    }

    public void setTotal(long total) {
        this.total = total;
    }

    public long getOnline() {
        return online;
    }

    public void setOnline(long online) {
        this.online = online;
    }

    public long getIdle() {
        return idle;
    }

    public void setIdle(long idle) {
        this.idle = idle;
    }

    public long getOffline() {
        return offline;
    }

    public void setOffline(long offline) {
        this.offline = offline;
    }

    public long getNeedsAttention() {
        return needsAttention;
    }

    public void setNeedsAttention(long needsAttention) {
        this.needsAttention = needsAttention;
    }
}
