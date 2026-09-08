import os
import sys
import socket
import threading
import time
import uvicorn
import webview
from config import load_settings


class Server(uvicorn.Server):
    """Uvicorn server that can be stopped cleanly from another thread."""
    def install_signal_handlers(self):
        pass  # Don't install signal handlers in a non-main thread


def find_available_port(preferred_port, max_tries=10):
    """Try the preferred port first, then scan upward to find an open one."""
    for offset in range(max_tries):
        port = preferred_port + offset
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(("127.0.0.1", port))
                return port
        except OSError:
            continue
    return None


def start_server(port):
    """Run the FastAPI app via uvicorn in a background thread."""
    config = uvicorn.Config(
        "main:app",
        host="127.0.0.1",
        port=port,
        log_level="info"
    )
    server = Server(config)
    server.run()


if __name__ == "__main__":
    settings = load_settings()
    preferred_port = settings.get("port", 8765)

    # Find an available port (handles TIME_WAIT / port-in-use gracefully)
    port = find_available_port(preferred_port)
    if port is None:
        print(f"ERROR: Could not find an available port near {preferred_port}.")
        sys.exit(1)
    if port != preferred_port:
        print(f"  Port {preferred_port} is busy, using port {port} instead.")

    print("=" * 60)
    print("  SoundScope — Native Desktop App")
    print(f"  Starting server on: http://127.0.0.1:{port}")
    print("=" * 60)

    # Start FastAPI/Uvicorn server in a daemon background thread
    server_thread = threading.Thread(target=start_server, args=(port,), daemon=True)
    server_thread.start()

    # Give the server a moment to spin up
    time.sleep(1.5)

    # Launch the native desktop window (blocks until user closes it)
    window = webview.create_window(
        "SoundScope",
        f"http://127.0.0.1:{port}",
        width=1200,
        height=800,
        min_size=(900, 600),
        text_select=True,
    )
    webview.start()

    # When the window is closed, the daemon server thread terminates automatically
    print("\nSoundScope window closed. Goodbye!")
