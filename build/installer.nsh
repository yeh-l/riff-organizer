!ifndef BUILD_UNINSTALLER
!define /redef APP_FILENAME "Riff Organizer"
!include "MUI2.nsh"
!include "Sections.nsh"

Section /o "Clean - Bugera G5 Infinium Clean USA DI by durchschnittsmusiker.nam" CLEAN_MODEL_SECTION
    SetShellVarContext current
    SetOutPath "$APPDATA\riff-organizer\models"
    File "${BUILD_RESOURCES_DIR}\Clean - Bugera G5 Infinium Clean USA DI by durchschnittsmusiker.nam"
SectionEnd

Section /o "Crunch - 1968 KT66 Marshall Plexi style amp v2.0 by ezlemoen.nam" CRUNCH_MODEL_SECTION
    SetShellVarContext current
    SetOutPath "$APPDATA\riff-organizer\models"
    File "${BUILD_RESOURCES_DIR}\Crunch - 1968 KT66 Marshall Plexi style amp v2.0 by ezlemoen.nam"
SectionEnd

Section /o "High Gain - EVH 5150 III Boosted by braindeadtx.nam" HIGH_GAIN_MODEL_SECTION
    SetShellVarContext current
    SetOutPath "$APPDATA\riff-organizer\models"
    File "${BUILD_RESOURCES_DIR}\High Gain - EVH 5150 III Boosted by braindeadtx.nam"
SectionEnd

Section /o "Cab IR - Marshall 1960ax SM57.wav" CAB_MODEL_SECTION
    SetShellVarContext current
    SetOutPath "$APPDATA\riff-organizer\models"
    File "/oname=Cab IR - Marshall 1960ax SM57.wav" "${BUILD_RESOURCES_DIR}\IR-marshall-1960ax-sm57-48k-24bit.wav"
SectionEnd

!macro customPageAfterChangeDir
    !insertmacro MUI_PAGE_COMPONENTS

    !insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
        !insertmacro MUI_DESCRIPTION_TEXT ${CLEAN_MODEL_SECTION} "Optional NAM amp model for playing audio in the app."
        !insertmacro MUI_DESCRIPTION_TEXT ${CRUNCH_MODEL_SECTION} "Optional NAM amp model for playing audio in the app."
        !insertmacro MUI_DESCRIPTION_TEXT ${HIGH_GAIN_MODEL_SECTION} "Optional NAM amp model for playing audio in the app."
        !insertmacro MUI_DESCRIPTION_TEXT ${CAB_MODEL_SECTION} "Optional Cabinet IR for playing audio in the app."
    !insertmacro MUI_FUNCTION_DESCRIPTION_END
!macroend

!macro customInit
    SectionSetText 4 ""
    SectionSetFlags ${CLEAN_MODEL_SECTION} ${SF_SELECTED}
    SectionSetFlags ${CRUNCH_MODEL_SECTION} ${SF_SELECTED}
    SectionSetFlags ${HIGH_GAIN_MODEL_SECTION} ${SF_SELECTED}
    SectionSetFlags ${CAB_MODEL_SECTION} ${SF_SELECTED}
!macroend

!endif