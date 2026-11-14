"""
Zero-dependency HTTP User-Agent and Client Hints device and browser parser.
Follows the ERP Ponytail ladder: pure Python standard library regex and string manipulation.
"""

from __future__ import annotations

import ipaddress
import re
from typing import TypedDict


class ClientDeviceDetails(TypedDict):
    ip_address: str
    user_agent: str
    device_type: str
    device_name: str
    os_name: str
    browser_name: str
    client_platform: str


def extract_client_ip(meta: dict[str, object]) -> str:
    """
    Extract and validate client IP address from request META.
    Checks HTTP_X_FORWARDED_FOR, HTTP_X_REAL_IP, and REMOTE_ADDR.
    """
    forwarded = meta.get("HTTP_X_FORWARDED_FOR")
    if isinstance(forwarded, str) and forwarded.strip():
        # In a comma-separated list of IPs, the first one is the client.
        candidate = forwarded.split(",")[0].strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass

    real_ip = meta.get("HTTP_X_REAL_IP")
    if isinstance(real_ip, str) and real_ip.strip():
        try:
            ipaddress.ip_address(real_ip.strip())
            return real_ip.strip()
        except ValueError:
            pass

    remote_addr = meta.get("REMOTE_ADDR")
    if isinstance(remote_addr, str) and remote_addr.strip():
        try:
            ipaddress.ip_address(remote_addr.strip())
            return remote_addr.strip()
        except ValueError:
            pass

    return "127.0.0.1"


def detect_client_device(meta: dict[str, object]) -> ClientDeviceDetails:
    """
    Parses request META headers (User-Agent and Sec-CH-UA client hints)
    to identify the device type, device model name, OS, and browser.
    """
    raw_ua = str(meta.get("HTTP_USER_AGENT") or "")
    sec_platform = str(meta.get("HTTP_SEC_CH_UA_PLATFORM") or "").replace('"', "").strip()
    sec_mobile = str(meta.get("HTTP_SEC_CH_UA_MOBILE") or "").strip()
    sec_model = str(meta.get("HTTP_SEC_CH_UA_MODEL") or "").replace('"', "").strip()

    ip_address = extract_client_ip(meta)
    ua_lower = raw_ua.lower()

    device_type = "unknown"
    device_name = "Appareil inconnu"
    os_name = ""
    browser_name = ""
    client_platform = sec_platform or ""

    # --- 1. Detect OS & Platform ---
    if "iphone" in ua_lower or "ipad" in ua_lower or "ipod" in ua_lower:
        client_platform = "iOS"
        ios_match = re.search(r"os ([\d_]+) like mac os x", ua_lower)
        if ios_match:
            version_str = ios_match.group(1).replace("_", ".")
            os_name = f"iOS {version_str}"
        else:
            os_name = "iOS"
    elif "android" in ua_lower:
        client_platform = "Android"
        android_match = re.search(r"android ([\d.]+)", ua_lower)
        if android_match:
            os_name = f"Android {android_match.group(1)}"
        else:
            os_name = "Android"
    elif "macintosh" in ua_lower or "mac os x" in ua_lower or sec_platform.lower() == "macos":
        client_platform = "macOS"
        mac_match = re.search(r"mac os x ([\d_]+)", ua_lower)
        if mac_match:
            version_str = mac_match.group(1).replace("_", ".")
            os_name = f"macOS {version_str}"
        else:
            os_name = "macOS"
    elif "windows" in ua_lower or sec_platform.lower() == "windows":
        client_platform = "Windows"
        if "windows nt 10.0" in ua_lower:
            os_name = "Windows 10/11"
        elif "windows nt 6.3" in ua_lower:
            os_name = "Windows 8.1"
        elif "windows nt 6.1" in ua_lower:
            os_name = "Windows 7"
        else:
            os_name = "Windows"
    elif "linux" in ua_lower or sec_platform.lower() == "linux":
        client_platform = "Linux"
        if "ubuntu" in ua_lower:
            os_name = "Ubuntu Linux"
        elif "debian" in ua_lower:
            os_name = "Debian Linux"
        elif "fedora" in ua_lower:
            os_name = "Fedora Linux"
        else:
            os_name = "Linux"
    elif sec_platform:
        os_name = sec_platform

    # --- 2. Detect Device Type and Device Name ---
    if "ipad" in ua_lower:
        device_type = "tablet"
        device_name = "iPad"
    elif "iphone" in ua_lower:
        device_type = "mobile"
        device_name = "iPhone"
    elif client_platform == "Android" or "android" in ua_lower:
        is_tablet = "tablet" in ua_lower or ("mobile" not in ua_lower and sec_mobile != "?1")
        device_type = "tablet" if is_tablet else "mobile"

        # Try to extract Android model name from UA e.g. "SM-S928B", "Pixel 8"
        model_name = sec_model
        if not model_name:
            model_match = re.search(r"\(([^;]+; )*Android [^;]+; ([^;)]+)(;.*)?\)", raw_ua)
            if model_match:
                extracted = model_match.group(2).strip()
                # filter out generic build tokens
                if not extracted.lower().startswith("build"):
                    model_name = extracted

        if model_name:
            if "sm-" in model_name.lower():
                device_name = f"Samsung Galaxy ({model_name})"
            elif "pixel" in model_name.lower():
                device_name = f"Google {model_name}"
            else:
                device_name = f"Tablette {model_name}" if is_tablet else f"Smartphone {model_name}"
        else:
            device_name = "Tablette Android" if is_tablet else "Smartphone Android"
    elif client_platform == "macOS" or "macintosh" in ua_lower:
        device_type = "desktop"
        device_name = "MacBook / Mac"
    elif client_platform == "Windows" or "windows" in ua_lower:
        device_type = "desktop"
        device_name = "PC Windows"
    elif client_platform == "Linux" or "linux" in ua_lower:
        device_type = "desktop"
        device_name = "Poste Linux"
    else:
        if sec_mobile == "?1" or "mobile" in ua_lower:
            device_type = "mobile"
            device_name = "Appareil mobile"
        else:
            device_type = "desktop"
            device_name = "Ordinateur de bureau"

    # --- 3. Detect Browser ---
    if "edg/" in ua_lower or "edge/" in ua_lower:
        edge_match = re.search(r"edg[e]?/([\d.]+)", ua_lower)
        browser_name = f"Edge {edge_match.group(1).split('.')[0]}" if edge_match else "Edge"
    elif "opr/" in ua_lower or "opera" in ua_lower:
        opera_match = re.search(r"opr/([\d.]+)", ua_lower)
        browser_name = f"Opera {opera_match.group(1).split('.')[0]}" if opera_match else "Opera"
    elif "chrome/" in ua_lower or "crios/" in ua_lower:
        chrome_match = re.search(r"(?:chrome|crios)/([\d.]+)", ua_lower)
        browser_name = f"Chrome {chrome_match.group(1).split('.')[0]}" if chrome_match else "Chrome"
    elif "firefox/" in ua_lower or "fxios/" in ua_lower:
        ff_match = re.search(r"(?:firefox|fxios)/([\d.]+)", ua_lower)
        browser_name = f"Firefox {ff_match.group(1).split('.')[0]}" if ff_match else "Firefox"
    elif "safari/" in ua_lower and ("version/" in ua_lower or client_platform in ("iOS", "macOS")):
        safari_match = re.search(r"version/([\d.]+)", ua_lower)
        browser_name = f"Safari {safari_match.group(1).split('.')[0]}" if safari_match else "Safari"
    else:
        browser_name = "Navigateur Web"

    return {
        "ip_address": ip_address,
        "user_agent": raw_ua,
        "device_type": device_type,
        "device_name": device_name,
        "os_name": os_name or client_platform or "Inconnu",
        "browser_name": browser_name,
        "client_platform": client_platform,
    }
