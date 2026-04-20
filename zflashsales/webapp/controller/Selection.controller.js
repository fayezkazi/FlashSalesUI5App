sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/Token",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, Token, MessageBox, MessageToast, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("zfi.zflashsales.controller.Selection", {

        onInit: function () {
            // SourceLedger is pre-defaulted to "0L" in the view binding
        },

        // ============================================================
        // MultiInput token handling
        // ============================================================

        onMultiInputSubmit: function (oEvent) {
            var oInput  = oEvent.getSource();
            var sValue  = (oEvent.getParameter("value") || "").trim();
            if (!sValue) { return; }

            var sId    = oInput.getId();
            var oModel = this.getView().getModel();

            if (sId.endsWith("companyCodeInput")) {
                oModel.read("/I_CompanyCode", {
                    filters: [new Filter("CompanyCode", FilterOperator.EQ, sValue)],
                    urlParameters: { "$top": "1" },
                    success: function (oData) {
                        if (oData.results && oData.results.length > 0) {
                            var sName = oData.results[0].CompanyCodeName;
                            oInput.addToken(new Token({
                                key: sValue,
                                text: sValue + (sName ? " \u2013 " + sName : "")
                            }));
                            oInput.setValue("");
                        } else {
                            MessageBox.error("Invalid Company Code: \"" + sValue + "\"");
                        }
                    },
                    error: function () {
                        MessageBox.error("Could not validate Company Code.");
                    }
                });

            } else if (sId.endsWith("glAccountInput")) {
                oModel.read("/I_GLAccountStdVH", {
                    filters: [new Filter("GLAccount", FilterOperator.EQ, sValue)],
                    urlParameters: { "$top": "1" },
                    success: function (oData) {
                        if (oData.results && oData.results.length > 0) {
                            var sText = oData.results[0].GLAccount_Text;
                            oInput.addToken(new Token({
                                key: sValue,
                                text: sValue + (sText ? " \u2013 " + sText : "")
                            }));
                            oInput.setValue("");
                        } else {
                            MessageBox.error("Invalid GL Account: \"" + sValue + "\"");
                        }
                    },
                    error: function () {
                        MessageBox.error("Could not validate GL Account.");
                    }
                });

            } else if (sId.endsWith("productInput")) {
                oModel.read("/I_ProductStdVH", {
                    filters: [new Filter("Product", FilterOperator.EQ, sValue)],
                    urlParameters: { "$top": "1" },
                    success: function (oData) {
                        if (oData.results && oData.results.length > 0) {
                            var sText = oData.results[0].Product_Text;
                            oInput.addToken(new Token({
                                key: sValue,
                                text: sValue + (sText ? " \u2013 " + sText : "")
                            }));
                            oInput.setValue("");
                        } else {
                            MessageBox.error("Invalid Product: \"" + sValue + "\"");
                        }
                    },
                    error: function () {
                        MessageBox.error("Could not validate Product.");
                    }
                });

            } else if (sId.endsWith("profitCenterInput")) {
                oModel.read("/I_ProfitCenterStdVH", {
                    filters: [new Filter("ProfitCenter", FilterOperator.EQ, sValue)],
                    urlParameters: { "$top": "1" },
                    success: function (oData) {
                        if (oData.results && oData.results.length > 0) {
                            var sText = oData.results[0].ProfitCenter_Text;
                            oInput.addToken(new Token({
                                key: sValue,
                                text: sValue + (sText ? " \u2013 " + sText : "")
                            }));
                            oInput.setValue("");
                        } else {
                            MessageBox.error("Invalid Profit Center: \"" + sValue + "\"");
                        }
                    },
                    error: function () {
                        MessageBox.error("Could not validate Profit Center.");
                    }
                });

            } else {
                oInput.addToken(new Token({ key: sValue, text: sValue }));
                oInput.setValue("");
            }
        },

        onFiscalYearPeriodLiveChange: function (oEvent) {
            var oInput = oEvent.getSource();
            var sValue = oInput.getValue();
            if (!sValue) {
                oInput.setValueState("None");
                return;
            }
            // Accept format PPP/YYYY — exactly 3 digits, slash, 4 digits
            var rFormat = /^\d{3}\/\d{4}$/;
            if (rFormat.test(sValue)) {
                oInput.setValueState("None");
            } else {
                oInput.setValueState("Error");
                oInput.setValueStateText("Invalid format. Please enter in PPP/YYYY format (e.g. 007/2021).");
            }
        },

        // ============================================================
        // Value Help – Company Code (I_CompanyCode)
        // ============================================================

        onCompanyCodeVHRequest: function () {
            var oView = this.getView();

            if (!this._oCompanyCodeDialog) {
                this.loadFragment({
                    name: "zfi.zflashsales.fragment.CompanyCodeVH"
                }).then(function (oDialog) {
                    // Register the OData model under the name used in the fragment
                    // binding path.  Without this step getBinding("items") is undefined.
                    oDialog.setModel(oView.getModel(), "I_CompanyCode");
                    this._oCompanyCodeDialog = oDialog;
                    this._oCompanyCodeDialog.open();
                }.bind(this));
            } else {
                this._oCompanyCodeDialog.open();
            }
        },

        onCompanyCodeVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            var oFilter = this._buildWildcardFilter(sValue, ["CompanyCode", "CompanyCodeName"]);
            var aFilters = oFilter ? [oFilter] : [];
            this.byId("companyCodeVHList").getBinding("items").filter(aFilters);
        },

        onCompanyCodeVHConfirm: function () {
            var oMultiInput = this.getView().byId("companyCodeInput");
            var aSelectedItems = this.byId("companyCodeVHList").getSelectedItems();

            oMultiInput.removeAllTokens();
            aSelectedItems.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("I_CompanyCode");
                var sKey  = oCtx.getProperty("CompanyCode");
                var sText = oCtx.getProperty("CompanyCodeName");
                oMultiInput.addToken(new Token({
                    key: sKey,
                    text: sKey + (sText ? " \u2013 " + sText : "")
                }));
            });
            this._oCompanyCodeDialog.close();
        },

        onCompanyCodeVHSelectAll: function () {
            this.byId("companyCodeVHList").getItems().forEach(function (oItem) {
                oItem.setSelected(true);
            });
        },

        onCompanyCodeVHDeselectAll: function () {
            this.byId("companyCodeVHList").getItems().forEach(function (oItem) {
                oItem.setSelected(false);
            });
        },

        // ============================================================
        // Value Help – G/L Account (I_GLAccountStdVH)
        // ============================================================

        onGLAccountVHRequest: function () {
            var oView = this.getView();

            if (!this._oGLAccountDialog) {
                this.loadFragment({
                    name: "zfi.zflashsales.fragment.GLAccountVH"
                }).then(function (oDialog) {
                    oDialog.setModel(oView.getModel(), "I_GLAccountStdVH");
                    this._oGLAccountDialog = oDialog;
                    this._applyGLAccountFilters();
                    this._oGLAccountDialog.open();
                }.bind(this));
            } else {
                this._applyGLAccountFilters();
                this._oGLAccountDialog.open();
            }
        },

        onGLAccountVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            this._applyGLAccountFilters(sValue);
        },

        // Builds and applies filters to the GL Account SelectDialog.
        // CompanyCode tokens entered on the Selection screen are always applied
        // as base filters; the optional sSearch value further narrows by
        // GLAccount or GLAccount_Text.
        _applyGLAccountFilters: function (sSearch) {
            var aFilters = [];

            // --- CompanyCode restriction ---
            var aTokens = this.getView().byId("companyCodeInput").getTokens();
            if (aTokens.length > 0) {
                var aCCFilters = aTokens.map(function (oToken) {
                    return new Filter("CompanyCode", FilterOperator.EQ, oToken.getKey());
                });
                aFilters.push(
                    aCCFilters.length === 1
                        ? aCCFilters[0]
                        : new Filter({ filters: aCCFilters, and: false })
                );
            }

            // --- Free-text search ---
            if (sSearch) {
                var oSearchFilter = this._buildWildcardFilter(sSearch, ["GLAccount", "GLAccount_Text"]);
                if (oSearchFilter) {
                    aFilters.push(oSearchFilter);
                }
            }

            this.byId("glAccountVHList").getBinding("items").filter(aFilters);
        },

        // Parses a wildcard search string (* = any characters) and returns a
        // combined OR Filter across the given fields using the appropriate
        // FilterOperator.  Patterns handled:
        //   text      → Contains  (implicit *text*)
        //   *text*    → Contains
        //   text*     → StartsWith
        //   *text     → EndsWith
        //   text*more → Contains on stripped value (best effort)
        _buildWildcardFilter: function (sValue, aFields) {
            if (!sValue) {
                return null;
            }

            var bLeadingStar  = sValue.startsWith("*");
            var bTrailingStar = sValue.endsWith("*");
            var sStripped     = sValue.replace(/\*/g, "");

            if (!sStripped) {
                return null;  // only asterisk(s) typed – show all
            }

            var sOperator;
            if (bLeadingStar && bTrailingStar) {
                sOperator = FilterOperator.Contains;
            } else if (bLeadingStar) {
                sOperator = FilterOperator.EndsWith;
            } else if (bTrailingStar) {
                sOperator = FilterOperator.StartsWith;
            } else {
                sOperator = FilterOperator.Contains;  // no wildcard → implicit contains
            }

            var aFieldFilters = aFields.map(function (sField) {
                return new Filter(sField, sOperator, sStripped);
            });

            return aFieldFilters.length === 1
                ? aFieldFilters[0]
                : new Filter({ filters: aFieldFilters, and: false });
        },

        onGLAccountVHConfirm: function () {
            var oMultiInput = this.getView().byId("glAccountInput");
            var aSelectedItems = this.byId("glAccountVHList").getSelectedItems();

            oMultiInput.removeAllTokens();
            aSelectedItems.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("I_GLAccountStdVH");
                var sKey  = oCtx.getProperty("GLAccount");
                var sText = oCtx.getProperty("GLAccount_Text");
                oMultiInput.addToken(new Token({
                    key: sKey,
                    text: sKey + (sText ? " \u2013 " + sText : "")
                }));
            });
            this._oGLAccountDialog.close();
        },

        onGLAccountVHSelectAll: function () {
            this.byId("glAccountVHList").getItems().forEach(function (oItem) {
                oItem.setSelected(true);
            });
        },

        onGLAccountVHDeselectAll: function () {
            this.byId("glAccountVHList").getItems().forEach(function (oItem) {
                oItem.setSelected(false);
            });
        },

        onVHCancel: function (oEvent) {
            // Source is SelectDialog (GLAccount) → has .close() directly.
            // Source is Button inside Dialog endButton (CompanyCode) → parent is the Dialog.
            var oSource = oEvent.getSource();
            (typeof oSource.close === "function" ? oSource : oSource.getParent()).close();
        },

        // ============================================================
        // Value Help – Product (I_ProductStdVH)
        // ============================================================

        onProductVHRequest: function () {
            var oView = this.getView();

            if (!this._oProductDialog) {
                this.loadFragment({
                    name: "zfi.zflashsales.fragment.ProductVH"
                }).then(function (oDialog) {
                    oDialog.setModel(oView.getModel(), "I_ProductStdVH");
                    this._oProductDialog = oDialog;
                    this._oProductDialog.open();
                }.bind(this));
            } else {
                this._oProductDialog.open();
            }
        },

        onProductVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            var oFilter = this._buildWildcardFilter(sValue, ["Product", "Product_Text"]);
            var aFilters = oFilter ? [oFilter] : [];
            this.byId("productVHList").getBinding("items").filter(aFilters);
        },

        onProductVHConfirm: function () {
            var oMultiInput = this.getView().byId("productInput");
            var aSelectedItems = this.byId("productVHList").getSelectedItems();

            oMultiInput.removeAllTokens();
            aSelectedItems.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("I_ProductStdVH");
                var sKey  = oCtx.getProperty("Product");
                var sText = oCtx.getProperty("Product_Text");
                oMultiInput.addToken(new Token({
                    key: sKey,
                    text: sKey + (sText ? " \u2013 " + sText : "")
                }));
            });
            this._oProductDialog.close();
        },

        onProductVHSelectAll: function () {
            this.byId("productVHList").getItems().forEach(function (oItem) {
                oItem.setSelected(true);
            });
        },

        onProductVHDeselectAll: function () {
            this.byId("productVHList").getItems().forEach(function (oItem) {
                oItem.setSelected(false);
            });
        },

        // ============================================================
        // Value Help – Profit Center (I_ProfitCenterStdVH)
        // ============================================================

        onProfitCenterVHRequest: function () {
            var oView = this.getView();

            if (!this._oProfitCenterDialog) {
                this.loadFragment({
                    name: "zfi.zflashsales.fragment.ProfitCenterVH"
                }).then(function (oDialog) {
                    oDialog.setModel(oView.getModel(), "I_ProfitCenterStdVH");
                    this._oProfitCenterDialog = oDialog;
                    this._oProfitCenterDialog.open();
                }.bind(this));
            } else {
                this._oProfitCenterDialog.open();
            }
        },

        onProfitCenterVHSearch: function (oEvent) {
            var sValue = oEvent.getParameter("newValue");
            var oFilter = this._buildWildcardFilter(sValue, ["ProfitCenter", "ProfitCenter_Text"]);
            var aFilters = oFilter ? [oFilter] : [];
            this.byId("profitCenterVHList").getBinding("items").filter(aFilters);
        },

        onProfitCenterVHConfirm: function () {
            var oMultiInput = this.getView().byId("profitCenterInput");
            var aSelectedItems = this.byId("profitCenterVHList").getSelectedItems();

            oMultiInput.removeAllTokens();
            aSelectedItems.forEach(function (oItem) {
                var oCtx = oItem.getBindingContext("I_ProfitCenterStdVH");
                var sKey  = oCtx.getProperty("ProfitCenter");
                var sText = oCtx.getProperty("ProfitCenter_Text");
                oMultiInput.addToken(new Token({
                    key: sKey,
                    text: sKey + (sText ? " \u2013 " + sText : "")
                }));
            });
            this._oProfitCenterDialog.close();
        },

        onProfitCenterVHSelectAll: function () {
            this.byId("profitCenterVHList").getItems().forEach(function (oItem) {
                oItem.setSelected(true);
            });
        },

        onProfitCenterVHDeselectAll: function () {
            this.byId("profitCenterVHList").getItems().forEach(function (oItem) {
                oItem.setSelected(false);
            });
        },

        // ============================================================
        // Clear & Display
        // ============================================================

        onClear: function () {
            var oView = this.getView();

            oView.byId("sourceLedgerInput").setValue("0L").setValueState("None");
            oView.byId("fiscalYearPeriodInput").setValue("").setValueState("None");

            var oCC = oView.byId("companyCodeInput");
            oCC.removeAllTokens();
            oCC.setValue("").setValueState("None");

            var oGL = oView.byId("glAccountInput");
            oGL.removeAllTokens();
            oGL.setValue("").setValueState("None");

            var oProd = oView.byId("productInput");
            oProd.removeAllTokens();
            oProd.setValue("").setValueState("None");

            var oPC = oView.byId("profitCenterInput");
            oPC.removeAllTokens();
            oPC.setValue("").setValueState("None");

            var oDRS = oView.byId("postingDateRange");
            oDRS.setDateValue(null);
            oDRS.setSecondDateValue(null);
            oDRS.setValueState("None");

            oView.byId("reportTypeCombo").setSelectedKey("").setValueState("None");

            MessageToast.show("Filters cleared.");
        },

        onDisplay: function () {
            var oView  = this.getView();
            var oSL    = oView.byId("sourceLedgerInput");
            var oFP    = oView.byId("fiscalYearPeriodInput");
            var oRT    = oView.byId("reportTypeCombo");
            var oCC    = oView.byId("companyCodeInput");
            var oGL    = oView.byId("glAccountInput");
            var oProd  = oView.byId("productInput");
            var oPC    = oView.byId("profitCenterInput");
            var oDRS   = oView.byId("postingDateRange");
            var bValid = true;

            if (!oSL.getValue().trim()) {
                oSL.setValueState("Error");
                oSL.setValueStateText("Source Ledger is required.");
                bValid = false;
            } else {
                oSL.setValueState("None");
            }

            if (!oFP.getValue().trim()) {
                oFP.setValueState("Error");
                oFP.setValueStateText("Fiscal Year / Period is required (e.g. 007/2021).");
                bValid = false;
            } else if (!/^\d{3}\/\d{4}$/.test(oFP.getValue().trim())) {
                oFP.setValueState("Error");
                oFP.setValueStateText("Invalid format. Please enter in PPP/YYYY format (e.g. 007/2021).");
                bValid = false;
            } else {
                oFP.setValueState("None");
            }

            if (!oRT.getSelectedKey()) {
                oRT.setValueState("Error");
                oRT.setValueStateText("Please select a report type.");
                bValid = false;
            } else {
                oRT.setValueState("None");
            }

            if (!bValid) {
                MessageBox.error("Please fill in all mandatory fields (marked with *) before proceeding.");
                return;
            }

            var oFilters = {
                SourceLedger:     oSL.getValue().trim(),
                FiscalYearPeriod: oFP.getValue().trim(),
                CompanyCode:      oCC.getTokens().map(function (t) { return t.getKey(); }),
                GLAccount:        oGL.getTokens().map(function (t) { return t.getKey(); }),
                Product:          oProd.getTokens().map(function (t) { return t.getKey(); }),
                ProfitCenter:     oPC.getTokens().map(function (t) { return t.getKey(); }),
                PostingDateFrom:  oDRS.getDateValue()       ? this._formatDate(oDRS.getDateValue())       : "",
                PostingDateTo:    oDRS.getSecondDateValue() ? this._formatDate(oDRS.getSecondDateValue()) : "",
                ReportType:       oRT.getSelectedKey()
            };

            var sResultID = encodeURIComponent(JSON.stringify(oFilters));
            var oRouter   = this.getOwnerComponent().getRouter();

            if (oRT.getSelectedKey() === "S") {
                oRouter.navTo("RouteResultSummery", { resultID: sResultID });
            } else {
                oRouter.navTo("RouteResultDetails", { resultID: sResultID });
            }
        },

        _formatDate: function (oDate) {
            var sYear = oDate.getFullYear();
            var sMon  = String(oDate.getMonth() + 1).padStart(2, "0");
            var sDay  = String(oDate.getDate()).padStart(2, "0");
            return sYear + "-" + sMon + "-" + sDay;
        }

    });
});
