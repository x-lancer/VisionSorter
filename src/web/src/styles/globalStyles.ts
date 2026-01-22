/**
 * 全局样式定义
 */
export const globalStyle = `
  html, body, #root {
    height: 100%;
    margin: 0;
    padding: 0;
  }
  .ant-card {
    border-radius: 0 !important;
  }
  .ant-card .ant-card-head {
    border-top-left-radius: 0 !important;
    border-top-right-radius: 0 !important;
  }
  .ant-card .ant-card-body {
    border-bottom-left-radius: 0 !important;
    border-bottom-right-radius: 0 !important;
  }
  .root-tabs .ant-tabs-content-holder {
    flex: 1;
    overflow: hidden;
    min-height: 0;
  }
  .root-tabs .ant-tabs-content {
    height: 100%;
  }
  .root-tabs .ant-tabs-tabpane {
    height: 100%;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  .ant-tabs-card > .ant-tabs-nav {
    margin-bottom: 0;
  }
  .ant-tabs-card > .ant-tabs-content-holder {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
  .ant-tabs-card.ant-tabs-top > .ant-tabs-content-holder {
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
`;
