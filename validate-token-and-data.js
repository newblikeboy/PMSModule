const FyersAPI = require("fyers-api-v3").fyersModel
const dotenv = require("dotenv");
dotenv.config();

const appId = process.env.FYERS_APP_ID
const redirectUrl = process.env.FYERS_REDIRECT_URI



var fyers = new FyersAPI()
fyers.setAppId(appId)
fyers.setRedirectUrl(redirectUrl)
fyers.setAccessToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOlsiZDoxIiwiZDoyIiwieDowIiwieDoxIiwieDoyIl0sImF0X2hhc2giOiJnQUFBQUFCcEFLUHMwb2FfXzJPUzljQVBZOXpjVDJvM3dmV3haOUd1NWlSNmhWbWVSbU1uY1NMaHNEbnRWUmR3NzBZYklsUDh5YnZYVTRUU0VyWXlYMmdwaFdhcTZFcHFhb3FReVp6N2VQbHpPOEdXc3UtakV0bz0iLCJkaXNwbGF5X25hbWUiOiIiLCJvbXMiOiJLMSIsImhzbV9rZXkiOiJkY2E4NmNiODBmNzYyYTY1MmY4YjIzOTJiY2E3YWJhZGUxNTg4M2JhYjM1YWQ2NGZmMzkxMDFiYiIsImlzRGRwaUVuYWJsZWQiOiJOIiwiaXNNdGZFbmFibGVkIjoiTiIsImZ5X2lkIjoiRkFFMDQ4NjEiLCJhcHBUeXBlIjoxMDAsImV4cCI6MTc2MTY5NzgwMCwiaWF0IjoxNzYxNjQ5NjQ0LCJpc3MiOiJhcGkuZnllcnMuaW4iLCJuYmYiOjE3NjE2NDk2NDQsInN1YiI6ImFjY2Vzc190b2tlbiJ9.LaG7Aqaj7CGksoM3mum3id5gwz5OztXD27Zkl5qsJdA")

var inp={
    "symbol":"NSE:SBIN-EQ",
    "resolution":"D",
    "date_format":"0",
    "range_from":"1690895316",
    "range_to":"1691068173",
    "cont_flag":"1"
}
fyers.getHistory(inp).then((response)=>{
    console.log(response)
}).catch((err)=>{
    console.log(err)
})

