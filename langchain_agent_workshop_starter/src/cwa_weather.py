"""中央氣象署（CWA）開放資料 API 用戶端。

這個模組只負責「取得資料 + 轉成結構化物件」，不牽涉 LLM，
方便在課堂上把「外部 API 呼叫」與「agent 推理」分開講解。

使用資料集：F-C0032-001（一般天氣預報－今明 36 小時天氣預報，縣市層級）
文件：https://opendata.cwa.gov.tw/dist/opendata-swagger.html

授權碼申請（免費）：
1. 到 https://opendata.cwa.gov.tw 註冊會員。
2. 進入「取得授權碼」頁面，複製 CWA-XXXXXXXX-... 格式的金鑰。
3. 寫進專案根目錄的 .env：CWA_API_KEY=你的授權碼（不要寫死在程式碼裡）。
"""

from __future__ import annotations

import json
import os
import ssl
import sys
from typing import Any, Iterable

import certifi
import requests
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from requests.adapters import HTTPAdapter

load_dotenv()

# 一般天氣預報－今明 36 小時天氣預報
CWA_ENDPOINT = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001"
DATA_SOURCE = "中央氣象署 CWA Open Data F-C0032-001（今明 36 小時天氣預報）"
REQUEST_TIMEOUT_SECONDS = 15

# F-C0032-001 只接受 22 個直轄市/縣市的正式名稱，使用者常用的簡稱要先正規化。
CITY_ALIASES: dict[str, str] = {
    "臺北": "臺北市",
    "北市": "臺北市",
    "新北": "新北市",
    "桃園": "桃園市",
    "臺中": "臺中市",
    "臺南": "臺南市",
    "高雄": "高雄市",
    "基隆": "基隆市",
    "新竹": "新竹市",
    "苗栗": "苗栗縣",
    "彰化": "彰化縣",
    "南投": "南投縣",
    "雲林": "雲林縣",
    "嘉義": "嘉義市",
    "屏東": "屏東縣",
    "宜蘭": "宜蘭縣",
    "花蓮": "花蓮縣",
    "臺東": "臺東縣",
    "澎湖": "澎湖縣",
    "金門": "金門縣",
    "連江": "連江縣",
    "馬祖": "連江縣",
}

VALID_CITIES: frozenset[str] = frozenset(
    {
        "臺北市", "新北市", "桃園市", "臺中市", "臺南市", "高雄市",
        "基隆市", "新竹市", "新竹縣", "苗栗縣", "彰化縣", "南投縣",
        "雲林縣", "嘉義市", "嘉義縣", "屏東縣", "宜蘭縣", "花蓮縣",
        "臺東縣", "澎湖縣", "金門縣", "連江縣",
    }
)


class CWAWeatherError(RuntimeError):
    """呼叫氣象署 API 或解析資料失敗時拋出，讓呼叫端能給出清楚的訊息。"""


class _TWCACompatAdapter(HTTPAdapter):
    """讓 Python 3.13+ 能連上氣象署網站的 TLS 相容性設定。

    問題：Python 3.13 起 ssl.create_default_context() 預設開啟 VERIFY_X509_STRICT，
    會要求 CA 憑證必須帶有 RFC 5280 規定的 Subject Key Identifier 欄位。
    氣象署使用的 TWCA Secure SSL CA 中繼憑證缺少這個欄位，握手就會失敗：
    「CERTIFICATE_VERIFY_FAILED: Missing Subject Key Identifier」。

    做法：只關掉 VERIFY_X509_STRICT 這一項「憑證格式嚴格度」檢查。
    憑證鏈驗證、有效期限、主機名稱比對全部保留 —— 這和 verify=False
    （完全不驗證、可被中間人攻擊）是完全不同的兩件事，課堂上請務必區分。
    """

    def init_poolmanager(self, *args, **kwargs):  # type: ignore[override]
        context = ssl.create_default_context(cafile=certifi.where())
        context.verify_flags &= ~ssl.VERIFY_X509_STRICT
        kwargs["ssl_context"] = context
        return super().init_poolmanager(*args, **kwargs)


_session: requests.Session | None = None


def _get_session() -> requests.Session:
    """建立（並重用）掛好 TLS 設定的 Session。"""
    global _session
    if _session is None:
        session = requests.Session()
        session.mount("https://", _TWCACompatAdapter())
        _session = session
    return _session


def _redact(text: str, secret: str) -> str:
    """把授權碼從訊息中遮蔽掉。

    requests 的例外訊息會帶上完整 URL，而授權碼是放在 query string 裡的，
    直接印出來就等於把金鑰寫進終端機和日誌。
    """
    if secret and secret in text:
        return text.replace(secret, "CWA-***")
    return text


class WeatherPeriod(BaseModel):
    """單一預報時段（F-C0032-001 每個縣市固定回傳 3 個 12 小時時段）。"""

    start_time: str = Field(description="時段開始時間，例如 2026-09-04 18:00:00")
    end_time: str = Field(description="時段結束時間")
    description: str = Field(default="", description="天氣現象，例如 多雲短暫陣雨")
    min_temp_c: int | None = Field(default=None, description="最低溫（攝氏）")
    max_temp_c: int | None = Field(default=None, description="最高溫（攝氏）")
    pop_percent: int | None = Field(default=None, description="降雨機率（%）")
    comfort: str = Field(default="", description="舒適度描述，例如 舒適至悶熱")


class CityWeatherReport(BaseModel):
    """單一縣市的完整預報，是本模組對外的結構化資料格式。"""

    city: str = Field(description="正規化後的縣市名稱")
    data_source: str = Field(default=DATA_SOURCE, description="資料來源")
    periods: list[WeatherPeriod] = Field(default_factory=list, description="各預報時段")


def normalize_city(city: str) -> str:
    """把使用者輸入（台北 / 台北市 / 北市）正規化成 API 接受的縣市名稱。"""
    name = (city or "").strip().replace(" ", "")
    # 氣象署一律使用「臺」，但使用者多半打「台」。
    name = name.replace("台", "臺")
    if name in VALID_CITIES:
        return name
    if name in CITY_ALIASES:
        return CITY_ALIASES[name]
    # 允許「臺北市中山區」這種輸入：取開頭能對上的縣市。
    for candidate in VALID_CITIES:
        if name.startswith(candidate):
            return candidate
    raise CWAWeatherError(
        f"無法辨識縣市「{city}」。F-C0032-001 只提供 22 個縣市，例如：臺北市、臺中市、高雄市。"
    )


def _pick(data: dict[str, Any], *keys: str) -> Any:
    """氣象署部分資料集已改用大寫開頭欄位名，這裡同時容忍新舊兩種寫法。"""
    for key in keys:
        if key in data:
            return data[key]
    return None


def _parameter_value(entry: dict[str, Any]) -> str:
    """取出單一時段的數值：舊格式放在 parameter，新格式放在 elementValue。"""
    parameter = _pick(entry, "parameter", "Parameter")
    if isinstance(parameter, dict):
        value = _pick(parameter, "parameterName", "ParameterName")
        return "" if value is None else str(value)

    element_value = _pick(entry, "elementValue", "ElementValue")
    if isinstance(element_value, list) and element_value:
        element_value = element_value[0]
    if isinstance(element_value, dict):
        # 新格式的欄位名稱隨元素而異（Temperature、ProbabilityOfPrecipitation…），取第一個非空值即可。
        for value in element_value.values():
            if value is not None:
                return str(value)
    if isinstance(element_value, str):
        return element_value
    return ""


def _to_int(value: str) -> int | None:
    """API 的數值是字串，且降雨機率可能是 " "（表示無資料）。"""
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def _iter_locations(records: dict[str, Any]) -> Iterable[dict[str, Any]]:
    """回傳 records 底下的地點清單，同時支援 location 與 Locations 兩種結構。"""
    locations = _pick(records, "location", "Location")
    if isinstance(locations, list):
        return locations

    grouped = _pick(records, "locations", "Locations")
    if isinstance(grouped, list):
        result: list[dict[str, Any]] = []
        for group in grouped:
            inner = _pick(group, "location", "Location")
            if isinstance(inner, list):
                result.extend(inner)
        return result
    return []


def _parse_location(location: dict[str, Any], city: str) -> CityWeatherReport:
    """把一個地點的 weatherElement 陣列，攤平成以「時段」為單位的結構化資料。

    原始格式是「元素 → 時段」的巢狀結構（Wx 有 3 段、PoP 有 3 段…），
    但人和模型比較好懂的是「時段 → 各元素」，所以這裡做一次轉置。
    """
    periods: dict[tuple[str, str], WeatherPeriod] = {}

    elements = _pick(location, "weatherElement", "WeatherElement") or []
    for element in elements:
        name = _pick(element, "elementName", "ElementName") or ""
        for entry in _pick(element, "time", "Time") or []:
            start = str(_pick(entry, "startTime", "StartTime") or "")
            end = str(_pick(entry, "endTime", "EndTime") or "")
            value = _parameter_value(entry)

            period = periods.setdefault(
                (start, end), WeatherPeriod(start_time=start, end_time=end)
            )
            if name == "Wx":
                period.description = value
            elif name == "PoP":
                period.pop_percent = _to_int(value)
            elif name == "MinT":
                period.min_temp_c = _to_int(value)
            elif name == "MaxT":
                period.max_temp_c = _to_int(value)
            elif name == "CI":
                period.comfort = value

    ordered = [periods[key] for key in sorted(periods)]
    return CityWeatherReport(city=city, periods=ordered)


def fetch_city_weather(city: str, api_key: str | None = None) -> CityWeatherReport:
    """查詢單一縣市的 36 小時預報，回傳 CityWeatherReport。

    參數：
        city: 縣市名稱，可用簡稱（台北、高雄）。
        api_key: 氣象署授權碼；預設讀環境變數 CWA_API_KEY。
    """
    key = api_key or os.getenv("CWA_API_KEY", "")
    if not key:
        raise CWAWeatherError(
            "找不到 CWA_API_KEY。請到 https://opendata.cwa.gov.tw 申請免費授權碼，"
            "並寫進 .env（CWA_API_KEY=...）。"
        )

    location_name = normalize_city(city)
    params = {
        "Authorization": key,
        "format": "JSON",
        "locationName": location_name,
    }

    try:
        response = _get_session().get(
            CWA_ENDPOINT, params=params, timeout=REQUEST_TIMEOUT_SECONDS
        )
    except requests.RequestException as exc:
        raise CWAWeatherError(f"連線氣象署 API 失敗：{_redact(str(exc), key)}") from exc

    if response.status_code == 401:
        raise CWAWeatherError("授權碼無效（HTTP 401），請確認 .env 的 CWA_API_KEY。")
    if response.status_code != 200:
        raise CWAWeatherError(
            f"氣象署 API 回應 HTTP {response.status_code}："
            f"{_redact(response.text[:200], key)}"
        )

    try:
        payload = response.json()
    except ValueError as exc:
        raise CWAWeatherError("氣象署 API 回應不是合法 JSON。") from exc

    # success 在成功時是字串 "true"（不是布林值），這是這個 API 常見的踩雷點。
    if str(payload.get("success", "")).lower() not in {"true", "1"}:
        raise CWAWeatherError(f"氣象署 API 回報查詢失敗：{payload}")

    locations = list(_iter_locations(payload.get("records", {})))
    if not locations:
        raise CWAWeatherError(f"氣象署沒有回傳「{location_name}」的資料。")

    report = _parse_location(locations[0], location_name)
    if not report.periods:
        raise CWAWeatherError(f"「{location_name}」解析後沒有任何時段，資料格式可能已變更。")
    return report


def format_report_for_llm(report: CityWeatherReport) -> str:
    """把結構化資料轉成精簡文字，作為 tool 回傳給模型的內容。

    刻意保留單位與時間範圍：模型只看得到 tool 回傳的字串，
    資訊不足就只能猜，最後填進 schema 的欄位就會失真。
    """
    lines = [f"{report.city} 天氣預報（來源：{report.data_source}）"]
    for period in report.periods:
        temp = "溫度不明"
        if period.min_temp_c is not None and period.max_temp_c is not None:
            temp = f"{period.min_temp_c}~{period.max_temp_c}°C"
        pop = "降雨機率不明" if period.pop_percent is None else f"降雨機率 {period.pop_percent}%"
        lines.append(
            f"- {period.start_time} 至 {period.end_time}："
            f"{period.description or '天氣現象不明'}，{temp}，{pop}，"
            f"舒適度：{period.comfort or '不明'}"
        )
    return "\n".join(lines)


if __name__ == "__main__":
    # 單獨執行可先驗證 API 串接是否正常：python src/cwa_weather.py 臺中市
    target = sys.argv[1] if len(sys.argv) > 1 else "臺北市"
    try:
        result = fetch_city_weather(target)
    except CWAWeatherError as error:
        print(f"查詢失敗：{error}")
        raise SystemExit(1)

    print(format_report_for_llm(result))
    print("\nJSON：")
    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))
