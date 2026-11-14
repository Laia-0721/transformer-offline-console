; -----------------------------------------------------------------------------
; 变压器离线运维控制台 - 安装器自定义页面
; -----------------------------------------------------------------------------
; 功能：
;   1. 安装前检测本机是否已安装，并展示版本与现有安装路径；
;   2. 始终提供安装位置输入框与“浏览”按钮，便于选择安装目录；
;   3. 仅允许当前用户安装，避免重复的全局安装；
;   4. 修改安装路径时提示会先卸载旧版本，防止重复安装。
;
; 说明：
;   electron-builder 使用 makensis -INPUTCHARSET UTF8 编译本文件，
;   本文件必须保存为 UTF-8（无 BOM），避免中文页面出现乱码。
; -----------------------------------------------------------------------------

!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "FileFunc.nsh"

; 强制按当前用户安装，跳过“为所有用户/当前用户”选择页。
!macro customInstallMode
  StrCpy $isForceCurrentInstall "1"
!macroend

; 安装模式确认后、写入文件之前显示“本机检测与安装位置”页面。
!macro customPageAfterChangeDir
  Var LocalSetupDialog
  Var LocalSetupPathInput
  Var LocalSetupBrowseButton
  Var LocalSetupDetectLabel
  Var LocalSetupHintLabel
  Var LocalSetupExisting
  Var LocalSetupExistingVersion
  Var LocalSetupExistingPath

  Page custom LocalSetupPageCreate LocalSetupPageLeave

  Function LocalSetupPageCreate
    !insertmacro MUI_HEADER_TEXT "本机检测与安装位置" "确认安装状态，并选择目标目录"

    nsDialogs::Create 1018
    Pop $LocalSetupDialog
    ${If} $LocalSetupDialog == error
      Abort
    ${EndIf}

    ; 这是安装向导的第一页，禁用返回按钮避免跳回被跳过的安装模式页。
    GetDlgItem $0 $HWNDPARENT 3
    EnableWindow $0 0

    ; ---- 读取已有安装信息（HKCU 优先，其次 HKLM） ----
    StrCpy $LocalSetupExisting "0"
    StrCpy $LocalSetupExistingVersion ""
    StrCpy $LocalSetupExistingPath ""

    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ReadRegStr $1 HKCU "${UNINSTALL_REGISTRY_KEY}" DisplayVersion

    ${If} $0 == ""
      ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation
      ReadRegStr $1 HKLM "${UNINSTALL_REGISTRY_KEY}" DisplayVersion
    ${EndIf}

    ${If} $0 != ""
      StrCpy $LocalSetupExistingPath "$0"
      StrCpy $LocalSetupExistingVersion "$1"
      StrCpy $LocalSetupExisting "1"
    ${ElseIf} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
      StrCpy $LocalSetupExistingPath "$INSTDIR"
      StrCpy $LocalSetupExisting "1"
    ${EndIf}

    ${If} $LocalSetupExisting == "1"
    ${AndIf} $LocalSetupExistingVersion == ""
      StrCpy $LocalSetupExistingVersion "未知版本"
    ${EndIf}

    ; ---- 本机检测结果 ----
    ${If} $LocalSetupExisting == "1"
      StrCpy $2 "本机检测：已安装 ${PRODUCT_NAME} $LocalSetupExistingVersion$\r$\n当前安装位置：$LocalSetupExistingPath$\r$\n继续安装将覆盖程序文件，但保留本机配置与模拟数据。"
    ${Else}
      StrCpy $2 "本机检测：未发现已安装版本，将进行全新安装。$\r$\n请选择安装位置；安装程序会创建目标目录并写入本地程序文件。"
    ${EndIf}

    ${NSD_CreateLabel} 0 0 300u 43u "$2"
    Pop $LocalSetupDetectLabel

    ${NSD_CreateLabel} 0 54u 300u 10u "安装位置（将直接安装到该目录）"
    Pop $0

    ${NSD_CreateText} 0 66u 246u 14u "$INSTDIR"
    Pop $LocalSetupPathInput

    ${NSD_CreateButton} 252u 65u 48u 16u "浏览..."
    Pop $LocalSetupBrowseButton
    ${NSD_OnClick} $LocalSetupBrowseButton LocalSetupBrowseFolder

    ${NSD_CreateLabel} 0 88u 300u 28u "建议选择有写入权限的独立目录。$\r$\n更改路径前请确认旧版本已不再使用。"
    Pop $LocalSetupHintLabel
    SetCtlColors $LocalSetupHintLabel 0x6B7280 0xFFFFFF

    ${NSD_CreateLabel} 0 120u 300u 30u "安装不会建立任何远程连接；所有程序文件、图标和运行资源均从安装包写入本机。"
    Pop $0
    SetCtlColors $0 0x6B7280 0xFFFFFF

    nsDialogs::Show
  FunctionEnd

  Function LocalSetupBrowseFolder
    Pop $0
    ${NSD_GetText} $LocalSetupPathInput $1
    nsDialogs::SelectFolderDialog "选择安装位置" "$1"
    Pop $1
    ${If} $1 != error
      ${NSD_SetText} $LocalSetupPathInput "$1"
    ${EndIf}
  FunctionEnd

  Function LocalSetupPageLeave
    ${NSD_GetText} $LocalSetupPathInput $INSTDIR

    ${If} $INSTDIR == ""
      MessageBox MB_ICONEXCLAMATION "请选择安装位置。"
      Abort
    ${EndIf}

    ; 若选择新路径，明确提示旧版本会被移除。
    ${If} $LocalSetupExisting == "1"
    ${AndIf} $INSTDIR != $LocalSetupExistingPath
      MessageBox MB_YESNO|MB_ICONQUESTION "检测到旧版本安装在：$\r$\n$LocalSetupExistingPath$\r$\n$\r$\n继续安装会先移除旧版本，再把新版本安装到：$\r$\n$INSTDIR$\r$\n$\r$\n是否继续？" IDYES +2
      Abort
    ${EndIf}

    ; 提前验证目录可以被创建和写入，避免安装到只读位置后才失败。
    ClearErrors
    CreateDirectory "$INSTDIR"
    ${If} ${Errors}
      MessageBox MB_ICONSTOP "无法创建安装目录：$\r$\n$INSTDIR$\r$\n$\r$\n请选择其他位置，或检查当前用户权限。"
      Abort
    ${EndIf}

    ClearErrors
    FileOpen $0 "$INSTDIR\.installer-write-test" w
    ${If} ${Errors}
      MessageBox MB_ICONSTOP "安装目录没有写入权限：$\r$\n$INSTDIR$\r$\n$\r$\n请选择其他位置，或使用有写入权限的账号。"
      Abort
    ${EndIf}
    FileClose $0
    Delete "$INSTDIR\.installer-write-test"
  FunctionEnd
!macroend
