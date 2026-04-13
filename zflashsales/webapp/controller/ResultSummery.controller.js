sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Spreadsheet) {
    "use strict";

    return Controller.extend("zfi.zflashsales.controller.ResultSummery", {

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("RouteResultSummery").attachPatternMatched(this._onRouteMatched, this);

            // View state model: filter chips + record count
            this.getView().setModel(new JSONModel({
                filters: {
                    SourceLedger: "",
                    FiscalYearPeriod: "",
                    CompanyCodeDisplay: "",
                    GLAccountDisplay: "",
                    PostingDateDisplay: ""
                },
                recordCount: 0
            }), "viewData");

            // Empty data model for the table
            this.getView().setModel(new JSONModel({ results: [] }), "flashSalesData");
        },

        // ============================================================
        // Route Matched
        // ============================================================

        _onRouteMatched: function (oEvent) {
            var sResultID = oEvent.getParameter("arguments").resultID;
            this._oFilterData = JSON.parse(decodeURIComponent(sResultID));

            this._updateFilterBar(this._oFilterData);
            this._loadData(this._oFilterData);
        },

        /**
         * Populates the sub-header filter chips from the parsed filter object.
         */
        _updateFilterBar: function (oFilterData) {
            var oViewData = this.getView().getModel("viewData");

            var aCC = oFilterData.CompanyCode && oFilterData.CompanyCode.length > 0 ? oFilterData.CompanyCode : [];
            var sCC = aCC.length > 3
                ? aCC.slice(0, 3).join(", ") + ", ..."
                : aCC.join(", ");

            var aGL = oFilterData.GLAccount && oFilterData.GLAccount.length > 0 ? oFilterData.GLAccount : [];
            var sGL = aGL.length > 3
                ? aGL.slice(0, 3).join(", ") + ", ..."
                : aGL.join(", ");

            var sDate = "";
            if (oFilterData.PostingDateFrom && oFilterData.PostingDateTo) {
                sDate = oFilterData.PostingDateFrom + " \u2013 " + oFilterData.PostingDateTo;
            } else if (oFilterData.PostingDateFrom) {
                sDate = "\u2265 " + oFilterData.PostingDateFrom;
            } else if (oFilterData.PostingDateTo) {
                sDate = "\u2264 " + oFilterData.PostingDateTo;
            }

            oViewData.setProperty("/filters", {
                SourceLedger: oFilterData.SourceLedger || "",
                FiscalYearPeriod: oFilterData.FiscalYearPeriod || "",
                CompanyCodeDisplay: sCC,
                GLAccountDisplay: sGL,
                PostingDateDisplay: sDate
            });
        },

        // ============================================================
        // Data Load
        // ============================================================

        /**
         * Builds OData filters from the parsed filter object and reads
         * the FlashSalesExtractor entity set.  Results are stored in the
         * local "flashSalesData" JSON model.
         */
        _loadData: function (oFilterData) {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();
            var aFilters = [];

            // Source Ledger (mandatory)
            if (oFilterData.SourceLedger) {
                aFilters.push(new Filter("sourceledger", FilterOperator.EQ, oFilterData.SourceLedger));
            }

            // Fiscal Year / Period — range from <year>001 to entered period
            if (oFilterData.FiscalYearPeriod) {
                var sYear = oFilterData.FiscalYearPeriod.toString().substring(0, 4);
                var sPeriodFrom = sYear + "001";
                var sPeriodTo   = oFilterData.FiscalYearPeriod.toString();
                aFilters.push(new Filter({
                    filters: [
                        new Filter("FiscalYearPeriod", FilterOperator.GE, sPeriodFrom),
                        new Filter("FiscalYearPeriod", FilterOperator.LE, sPeriodTo)
                    ],
                    and: true
                }));
            }

            // Company Code — multiple values joined with OR
            if (oFilterData.CompanyCode && oFilterData.CompanyCode.length > 0) {
                var aCCFilters = oFilterData.CompanyCode.map(function (sCode) {
                    return new Filter("CompanyCode", FilterOperator.EQ, sCode);
                });
                aFilters.push(aCCFilters.length === 1
                    ? aCCFilters[0]
                    : new Filter({ filters: aCCFilters, and: false }));
            }

            // G/L Account — multiple values joined with OR
            if (oFilterData.GLAccount && oFilterData.GLAccount.length > 0) {
                var aGLFilters = oFilterData.GLAccount.map(function (sGL) {
                    return new Filter("GLAccount", FilterOperator.EQ, sGL);
                });
                aFilters.push(aGLFilters.length === 1
                    ? aGLFilters[0]
                    : new Filter({ filters: aGLFilters, and: false }));
            }

            // Posting Date range
            if (oFilterData.PostingDateFrom) {
                aFilters.push(new Filter("PostingDateFrom", FilterOperator.GE, new Date(oFilterData.PostingDateFrom)));
            }
            if (oFilterData.PostingDateTo) {
                aFilters.push(new Filter("PostingDateTo", FilterOperator.LE, new Date(oFilterData.PostingDateTo)));
            }

            oView.setBusy(true);

            var iPageSize   = 1000;
            var aAllResults = [];

            var fnError = function (oError) {
                oView.setBusy(false);
                var sMsg = "Failed to load Flash Sales data.";
                try {
                    sMsg = JSON.parse(oError.responseText).error.message.value || sMsg;
                } catch (e) { /* ignore */ }
                MessageBox.error(sMsg);
            }.bind(this);

            var fnReadPage = function (iSkip) {
                oModel.read("/FlashSalesSummery", {
                    filters: aFilters,
                    urlParameters: {
                        "$top":  iPageSize.toString(),
                        "$skip": iSkip.toString()
                    },
                    success: function (oData) {
                        aAllResults = aAllResults.concat(oData.results);

                        if (oData.results.length === iPageSize) {
                            // Full page returned — there may be more
                            fnReadPage(iSkip + iPageSize);
                        } else {
                            // Partial or empty page — all records fetched
                            oView.getModel("flashSalesData").setData({ results: aAllResults });
                            oView.getModel("viewData").setProperty("/recordCount", aAllResults.length);
                            oView.setBusy(false);
                        }
                    }.bind(this),
                    error: fnError
                });
            }.bind(this);

            fnReadPage(0);
        },

        // ============================================================
        // Header Action Buttons
        // ============================================================

        /**
         * Calls the sendEmail FunctionImport, passing the complete filter
         * criteria and the full result set as JSON strings.
         */
        onSendEmail: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();
            var aResults = oView.getModel("flashSalesData").getProperty("/results");

            if (!aResults || aResults.length === 0) {
                MessageToast.show("No data available to send.");
                return;
            }

            MessageBox.confirm("Send this Flash Sales Summary Report by email?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) { return; }

                    oView.setBusy(true);
                    var oFirst = aResults[0];

                    oModel.callFunction("/takeAction", {
                        method: "POST",
                        urlParameters: {
                            sourceledger: oFirst.sourceledger || "",
                            CompanyCode: oFirst.CompanyCode || "",
                            FiscalYearPeriod: oFirst.FiscalYearPeriod || "",
                            GLAccount: oFirst.GLAccount || "",
                            Product: oFirst.Product || "",
                            entityName: "FlashSalesSummery",
                            fullData: JSON.stringify(aResults),
                            actName: "Email"
                        },
                        success: function () {
                            oView.setBusy(false);
                            MessageToast.show("Email sent successfully.");
                        }.bind(this),
                        error: function () {
                            oView.setBusy(false);
                            MessageBox.error("Failed to send email. Please try again.");
                        }.bind(this)
                    });
                }.bind(this)
            });
        },

        /**
         * Calls the sendAPI FunctionImport for the first record in the
         * result set (key-based action).
         */
        onSendToAPI: function () {
            var oView = this.getView();
            var oModel = this.getOwnerComponent().getModel();
            var aResults = oView.getModel("flashSalesData").getProperty("/results");

            if (!aResults || aResults.length === 0) {
                MessageToast.show("No data available to send.");
                return;
            }

            MessageBox.confirm("Send the Flash Sales Summary data to the API?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) { return; }

                    oView.setBusy(true);
                    var oFirst = aResults[0];

                    oModel.callFunction("/takeAction", {
                        method: "POST",
                        urlParameters: {
                            sourceledger: oFirst.sourceledger || "",
                            CompanyCode: oFirst.CompanyCode || "",
                            FiscalYearPeriod: oFirst.FiscalYearPeriod || "",
                            GLAccount: oFirst.GLAccount || "",
                            Product: oFirst.Product || "",
                            entityName: "FlashSalesSummery",
                            fullData: JSON.stringify(aResults),
                            actName: "API"
                        },
                        success: function () {
                            oView.setBusy(false);
                            MessageToast.show("Data sent to API successfully.");
                        }.bind(this),
                        error: function () {
                            oView.setBusy(false);
                            MessageBox.error("Failed to send data to API. Please try again.");
                        }.bind(this)
                    });
                }.bind(this)
            });
        },

        //=============================================================
        // Download Result as Excel (Bonus)
        //=============================================================
        onDownloadSummery: function () {
            //DownLoad Excel Spreedsheet using sap.ui.export.Spreadsheet
            var oView = this.getView();
            var aResults = oView.getModel("flashSalesData").getProperty("/results");
            if (!aResults || aResults.length === 0) {
                MessageToast.show("No data available to download.");
                return;
            }
            var aColumns = [
                { label: "Source Ledger", property: "sourceledger" },
                { label: "Company Code", property: "CompanyCode" },
                { label: "Fiscal Year/Period", property: "FiscalYearPeriod" },
                { label: "GL Account", property: "GLAccount" },
                { label: "Product", property: "Product" },
                { label: "Quantity", property: "Quantity" },
                { label: "Base Unit", property: "BaseUnit" },
                { label: "Amount in Transaction Currency", property: "AmountInTransactionCurrency" },
                { label: "Transaction Currency", property: "TransactionCurrency" },
                { label: "Amount in Company Code Currency", property: "AmountInCompanyCodeCurrency" },
                { label: "Company Code Currency", property: "CompanyCodeCurrency" }
            ];
            var oSettings = {
                workbook: { columns: aColumns },
                dataSource: aResults,
                fileName: "FlashSalesSummary.xlsx"
            };
            var oSpreadsheet = new Spreadsheet(oSettings);
            oSpreadsheet.build().finally(function () {
                oSpreadsheet.destroy();
            });

        },
        onDownloadSummeryOLD: function () {
            var oView = this.getView();
            var aResults = oView.getModel("flashSalesData").getProperty("/results");
            if (!aResults || aResults.length === 0) {
                MessageToast.show("No data available to download.");
                return;
            }

            // Convert results to CSV format
            var sCSV = "Source Ledger,Company Code,Fiscal Year/Period,GL Account,Product,Quantity,Base Unit,Amount in Transaction Currency,Transaction Currency,Amount in Company Code Currency,Company Code Currency\n";
            aResults.forEach(function (oRow) {
                sCSV += [
                    oRow.sourceledger,
                    oRow.CompanyCode,
                    oRow.FiscalYearPeriod,
                    oRow.GLAccount,
                    oRow.Product,
                    oRow.Quantity,
                    oRow.BaseUnit,
                    oRow.AmountInTransactionCurrency,
                    oRow.TransactionCurrency,
                    oRow.AmountInCompanyCodeCurrency,
                    oRow.CompanyCodeCurrency
                ].join(",") + "\n";
            });

            // Trigger file download
            var oBlob = new Blob([sCSV], { type: "text/csv;charset=utf-8;" });
            var sFileName = "FlashSalesSummary.csv";
            if (navigator.msSaveBlob) { // IE 10+
                navigator.msSaveBlob(oBlob, sFileName);
            } else {
                var oLink = document.createElement("a");
                if (oLink.download !== undefined) { // feature detection
                    var sUrl = URL.createObjectURL(oBlob);
                    oLink.setAttribute("href", sUrl);
                    oLink.setAttribute("download", sFileName);
                    oLink.style.visibility = "hidden";
                    document.body.appendChild(oLink);
                    oLink.click();
                    document.body.removeChild(oLink);
                } else {
                    MessageBox.error("File download is not supported in this browser.");
                }
            }
        },
        // ============================================================
        // Navigation
        // ============================================================

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("RouteSelection");
        }
    });
});

