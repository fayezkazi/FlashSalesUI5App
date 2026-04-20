*&---------------------------------------------------------------------*
*& Build LT_FILEDATA (string table) from LT_FLASH_DATA and download
*& as a semicolon-delimited text file using GUI_DOWNLOAD.
*&
*& ASSUMPTIONS:
*&   - LT_FLASH_DATA fields used:
*&       COMPANYCODE, FISCYEARPERIOD, DIVISION, MATNR,
*&       MATERIALDESCRIPTION, BASEUNIT, MPGCODE, SOLDTOMARKET,
*&       TRANSACTIONCURRENCY, QUANTITY, AMOUNTINTRANSACTIONCURRENCY,
*&       SALESCHANNEL
*&   - FISCYEARPERIOD is 7 chars: YYYYPPP  (e.g. '2021001')
*&   - ZFI_FS_PROP_COMPANYCODE is a DB table mapping COMPANYCODE
*&     to FDM_COMPANY. Adjust field name if different.
*&---------------------------------------------------------------------*

*----------------------------------------------------------------------*
* Declarations
*----------------------------------------------------------------------*
  DATA: lt_filedata  TYPE TABLE OF string,
        lv_line      TYPE string,
        lv_period    TYPE string,
        lv_fiscyear  TYPE string,
        lv_fdm_comp  TYPE string,
        lv_qty_s     TYPE string,
        lv_amt_s     TYPE string,
        lv_cnt_s     TYPE string,
        lv_qty_sum   TYPE p LENGTH 16 DECIMALS 3,
        lv_amt_sum   TYPE p LENGTH 16 DECIMALS 2,
        lv_rec_count TYPE i,
        lv_filename  TYPE string.

*----------------------------------------------------------------------*
* Step 1: Derive Period and Fiscal Year from the first data record.
*         FISCYEARPERIOD layout: YYYYPPP → Year(4) + Period(3)
*         e.g. '2021001' → Fiscal Year = '2021', Period = '001'
*----------------------------------------------------------------------*
  READ TABLE lt_flash_data INDEX 1 INTO DATA(ls_first).
  CHECK sy-subrc = 0.                          "Nothing to do if table empty

  lv_fiscyear = ls_first-fiscyearperiod(4).    "'2021'
  lv_period   = ls_first-fiscyearperiod+4(3).  "'001'

*----------------------------------------------------------------------*
* Step 2: Record Type 1 – File Header  (one per file)
*   Fields: RecordType | Period | FiscalYear | DataType
*----------------------------------------------------------------------*
  CONCATENATE '1' lv_period lv_fiscyear 'IF_SL001'
    INTO lv_line SEPARATED BY ';'.
  APPEND lv_line TO lt_filedata.

*----------------------------------------------------------------------*
* Step 3: Sort LT_FLASH_DATA for GROUP BY processing
*----------------------------------------------------------------------*
  SORT lt_flash_data BY companycode division.

*----------------------------------------------------------------------*
* Step 4: Loop once per unique CompanyCode + Division combination.
*         Each iteration produces: Type 2 (header) + Type 3 (details)
*                                + Type 4 (footer)
*----------------------------------------------------------------------*
  LOOP AT lt_flash_data INTO DATA(ls_grp)
    GROUP BY ( companycode = ls_grp-companycode
               division    = ls_grp-division )
    ASCENDING.

    "-----------------------------------------------------------------
    " Look up FDM Company Code from mapping table ZFI_FS_PROP_COMPANYCODE
    " Adjust the field name FDM_COMPANY to match the actual table structure
    "-----------------------------------------------------------------
    SELECT SINGLE fdm_company
      FROM zfi_fs_prop_companycode
      WHERE companycode = @ls_grp-companycode
      INTO @lv_fdm_comp.
    IF sy-subrc <> 0.
      lv_fdm_comp = ls_grp-companycode.    "Fallback: use SAP Company Code
    ENDIF.
    CONDENSE lv_fdm_comp.

    "-----------------------------------------------------------------
    " Record Type 2 – Group Header (one per FDM Company / Division)
    "   Fields: RecordType | Period | FiscalYear | ReportingCorp | Division
    "-----------------------------------------------------------------
    CONCATENATE '2' lv_period lv_fiscyear lv_fdm_comp ls_grp-division
      INTO lv_line SEPARATED BY ';'.
    APPEND lv_line TO lt_filedata.

    CLEAR: lv_qty_sum, lv_amt_sum.

    "-----------------------------------------------------------------
    " Record Type 3 – Detail (one per sales record in this group)
    "   Fields: RecordType | ReportingCorp | Division | SKUCode |
    "           SKUDescription | UOM | ISPCode | MPGCode | SoldToMarket |
    "           TransactionCurrency | Quantity | Amount | SalesChannel
    "-----------------------------------------------------------------
    LOOP AT GROUP ls_grp INTO DATA(ls_det).

      lv_rec_count = lv_rec_count + 1.
      lv_qty_sum   = lv_qty_sum + ls_det-quantity.
      lv_amt_sum   = lv_amt_sum + ls_det-amountintransactioncurrency.

      "Convert numeric fields to clean string (no leading spaces)
      lv_qty_s = ls_det-quantity.                        CONDENSE lv_qty_s.
      lv_amt_s = ls_det-amountintransactioncurrency.     CONDENSE lv_amt_s.

      CONCATENATE '3'
        lv_fdm_comp
        ls_det-division
        ls_det-matnr
        ls_det-materialdescription
        ls_det-baseunit
        'WYISP'
        ls_det-mpgcode
        ls_det-soldtomarket
        ls_det-transactioncurrency
        lv_qty_s
        lv_amt_s
        ls_det-saleschannel
        INTO lv_line SEPARATED BY ';'.
      APPEND lv_line TO lt_filedata.

    ENDLOOP.  "LOOP AT GROUP ls_grp

    "-----------------------------------------------------------------
    " Record Type 4 – Group Footer (one per FDM Company / Division)
    "   Fields: RecordType | 'Reporting Corporation' | Division |
    "           'SUM' | SumQuantity | SumAmount
    "-----------------------------------------------------------------
    lv_qty_s = lv_qty_sum.    CONDENSE lv_qty_s.
    lv_amt_s = lv_amt_sum.    CONDENSE lv_amt_s.

    CONCATENATE '4' 'Reporting Corporation' ls_grp-division 'SUM' lv_qty_s lv_amt_s
      INTO lv_line SEPARATED BY ';'.
    APPEND lv_line TO lt_filedata.

  ENDLOOP.  "LOOP AT lt_flash_data GROUP BY

*----------------------------------------------------------------------*
* Step 5: Record Type 5 – File Footer  (one per file)
*   Fields: RecordType | 'COUNT' | TotalType3Records
*----------------------------------------------------------------------*
  lv_cnt_s = lv_rec_count.    CONDENSE lv_cnt_s.
  CONCATENATE '5' 'COUNT' lv_cnt_s
    INTO lv_line SEPARATED BY ';'.
  APPEND lv_line TO lt_filedata.

*----------------------------------------------------------------------*
* Step 6: Download LT_FILEDATA as text file via GUI_DOWNLOAD
*         Each entry in LT_FILEDATA is already a fully formatted line.
*         filetype = 'ASC' writes each table row as one line.
*         Adjust lv_filename to the desired output path.
*----------------------------------------------------------------------*
  lv_filename = 'C:\temp\FlashSales_Output.txt'.   "<-- Adjust path as needed

  CALL FUNCTION 'GUI_DOWNLOAD'
    EXPORTING
      filename                = lv_filename
      filetype                = 'ASC'
    TABLES
      data_tab                = lt_filedata
    EXCEPTIONS
      file_write_error        = 1
      no_batch                = 2
      gui_refuse_filetransfer = 3
      invalid_type            = 4
      no_authority            = 5
      unknown_error           = 6
      header_not_allowed      = 7
      separator_not_allowed   = 8
      filesize_not_allowed    = 9
      header_too_long         = 10
      dp_error_create         = 11
      dp_error_send           = 12
      dp_error_write          = 13
      unknown_dp_error        = 14
      access_denied           = 15
      dp_out_of_memory        = 16
      disk_full               = 17
      dp_timeout              = 18
      OTHERS                  = 19.
  IF sy-subrc <> 0.
    MESSAGE ID sy-msgid TYPE sy-msgty NUMBER sy-msgno
      WITH sy-msgv1 sy-msgv2 sy-msgv3 sy-msgv4.
  ENDIF.
