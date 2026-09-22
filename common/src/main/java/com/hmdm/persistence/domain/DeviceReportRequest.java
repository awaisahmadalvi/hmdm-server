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

package com.hmdm.persistence.domain;

import java.util.List;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * <p>A request for exporting a device report (Excel/PDF). Extends the regular
 * device search filter with the exact set of columns to include - this is
 * meant to mirror whichever columns the administrator currently has visible
 * on the Devices screen (see the "Visible columns" settings), so the
 * exported report always matches what's shown on screen.</p>
 */
@ApiModel(description = "A request for exporting a device report (Excel/PDF)")
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceReportRequest extends DeviceSearchRequest {

    private static final long serialVersionUID = 1L;

    @ApiModelProperty("The ordered list of column keys to include in the report (matches the on-screen visible columns)")
    private List<String> columns;

    @ApiModelProperty("The configured label for custom property #1, if enabled")
    private String custom1Label;

    @ApiModelProperty("The configured label for custom property #2, if enabled")
    private String custom2Label;

    @ApiModelProperty("The configured label for custom property #3, if enabled")
    private String custom3Label;

    public List<String> getColumns() {
        return columns;
    }

    public void setColumns(List<String> columns) {
        this.columns = columns;
    }

    public String getCustom1Label() {
        return custom1Label;
    }

    public void setCustom1Label(String custom1Label) {
        this.custom1Label = custom1Label;
    }

    public String getCustom2Label() {
        return custom2Label;
    }

    public void setCustom2Label(String custom2Label) {
        this.custom2Label = custom2Label;
    }

    public String getCustom3Label() {
        return custom3Label;
    }

    public void setCustom3Label(String custom3Label) {
        this.custom3Label = custom3Label;
    }
}
