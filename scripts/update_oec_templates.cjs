const fs = require('fs');
const path = require('path');

const DIRECTORY = '/Users/jenilrupapara/Downloads/22-05-26/';

const extractItemBlock = `
    <ExtractItem xsi:type="ExtractTextItem">
      <Id>999</Id>
      <ParentId>0</ParentId>
      <Name>ASIN</Name>
      <Header>ASIN</Header>
      <UseRelativeXPath>false</UseRelativeXPath>
      <RelativeXpath/>
      <BackUpRelativeXPath/>
      <BackUpIframeXPath/>
      <BackUpAbsXPath/>
      <AllowNull>true</AllowNull>
      <AllowSkip>false</AllowSkip>
      <AllowDefaultValue>false</AllowDefaultValue>
      <AlertWhenNotFound>false</AlertWhenNotFound>
      <AbsXpath>//ul[@class="a-unordered-list a-nostyle a-vertical a-spacing-none detail-bullet-list"]/li[4]/span[1]/span[2]</AbsXpath>
      <IsIFrame>false</IsIFrame>
      <IFrameAbsXPath/>
      <CustomizeField/>
      <ExtractType>ExtractText</ExtractType>
      <FixedValue/>
      <SourceUrl/>
      <IsAppend>false</IsAppend>
      <MatchAll>false</MatchAll>
      <NullValue/>
      <OCRType/>
      <PageSourceReg/>
      <type/>
      <IsUniqueGroup>false</IsUniqueGroup>
      <UseBackupPath>false</UseBackupPath>
      <UseBackupIframePath>false</UseBackupIframePath>
      <UseBackupRelativePath>false</UseBackupRelativePath>
      <IsDownloadFile>false</IsDownloadFile>
      <downloadFieldKey/>
      <DownloadFileConfig>
        <downloadFileRenameType>1</downloadFileRenameType>
        <repeatValue>2</repeatValue>
        <mutipleUrlConfig>
          <isIncludeMutipleUrl>false</isIncludeMutipleUrl>
          <urlSplitType>0</urlSplitType>
        </mutipleUrlConfig>
        <field/>
      </DownloadFileConfig>
      <belongTo>uc5153mum2m</belongTo>
      <uid>uc5153mum2m_999</uid>
      <MenuType>ShowXpathMenu</MenuType>
      <SampleValue/>
    </ExtractItem>
`;

async function processFiles() {
    console.log(`Scanning directory: ${DIRECTORY} for .oec files...`);
    const files = fs.readdirSync(DIRECTORY);
    let updatedCount = 0;

    for (const file of files) {
        if (file.endsWith('.oec')) {
            const filePath = path.join(DIRECTORY, file);
            let content = fs.readFileSync(filePath, 'utf8');

            // Find ExtractDataAction's ExtractItems list
            if (content.includes('<Name>ASIN</Name>')) {
                console.log(`[SKIP] ${file} already contains an ASIN extract item.`);
                continue;
            }

            // Simple string injection before the closing tag of the first ExtractItems we find
            // It's usually inside <Action xsi:type="ExtractDataAction">
            const injectionPoint = content.indexOf('</ExtractItems>');
            if (injectionPoint !== -1) {
                const newContent = content.slice(0, injectionPoint) + extractItemBlock + content.slice(injectionPoint);
                fs.writeFileSync(filePath, newContent, 'utf8');
                console.log(`[OK] Successfully injected ASIN block into ${file}`);
                updatedCount++;
            } else {
                console.log(`[WARN] Could not find </ExtractItems> in ${file}.`);
            }
        }
    }
    
    console.log(`\nProcess completed. Updated ${updatedCount} files.`);
}

processFiles();
