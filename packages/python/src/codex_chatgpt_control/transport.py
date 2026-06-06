from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .backend import BackendClient, BackendProtocolError, BackendTransportError, StdioBackendTransport


class NodeSidecarError(BackendTransportError):
    def __init__(self, message: str, *, returncode: int | None, stderr: str) -> None:
        super().__init__(message, returncode=returncode, stderr=stderr)


@dataclass(frozen=True)
class NodeSidecarTransport:
    command: list[str]
    timeout_seconds: float = 600.0
    env: dict[str, str] | None = field(default=None)

    def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        backend_transport = StdioBackendTransport(
            command=self.command,
            timeout_seconds=self.timeout_seconds,
            env=self.env,
        )
        client = BackendClient(backend_transport)
        try:
            return client.run(payload)
        except BackendTransportError as exc:
            raise NodeSidecarError(
                str(exc),
                returncode=exc.returncode,
                stderr=exc.stderr,
            ) from exc
        except BackendProtocolError as exc:
            raise NodeSidecarError(
                str(exc),
                returncode=None,
                stderr="",
            ) from exc
        finally:
            client.close()
