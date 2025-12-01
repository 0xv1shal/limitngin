import type {Config} from 'jest';

const config: Config = {
  verbose: true,
  preset: "ts-jest",
  reporters:[
    "default",
    [
      "jest-html-reporter", {
        "pageTitle": "Test Report",
        "outputPath": "./test-report.html",
        "includeFailureMsg": true,
        "includeStackTrace": true
      }
    ]
  ]
};

export default config;