from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .backend import BackendClient, BackendProtocolError, BackendTransportError, StdioBackendTransport


class NodeSidecarError(BackendTransportError):
    def __init__(self, message: str, *, returncode: int | None, stderr: str) -> None:
        super().__init__(message, returncode=returncode, stderr=stderr)


@dataclass(frozen=True)
class NodeSidecarTransport:
    """Run backend payloads through a spawned Node backend process.

    By default each ``run()`` call spawns a fresh backend subprocess and tears it down
    afterwards, so single calls stay stateless. Multi-command workflows can avoid paying
    Node startup per call by opening a persistent session, either explicitly with
    ``open()``/``close()`` or as a context manager::

        with NodeSidecarTransport(command=[...]) as transport:
            transport.run(first_payload)
            transport.run(second_payload)  # reuses the same backend process

    A transport-level failure (crash, invalid JSON, broken pipe) closes the persistent
    session because the subprocess is no longer trustworthy; protocol-level errors keep
    the session open, matching ``BackendClient`` semantics.
    """

    command: list[str]
    timeout_seconds: float = 600.0
    env: dict[str, str] | None = field(default=None)
    _session: BackendClient | None = field(init=False, default=None, repr=False, compare=False)

    def open(self) -> "NodeSidecarTransport":
        if self._session is None:
            object.__setattr__(self, "_session", self._create_client())
        return self

    def close(self) -> None:
        session = self._session
        if session is not None:
            object.__setattr__(self, "_session", None)
            session.close()

    def __enter__(self) -> "NodeSidecarTransport":
        return self.open()

    def __exit__(self, exc_type: object, exc: object, traceback: object) -> None:
        self.close()

    def run(self, payload: dict[str, Any]) -> dict[str, Any]:
        session = self._session
        if session is not None:
            return self._run_with(session, payload, close_after=False)
        return self._run_with(self._create_client(), payload, close_after=True)

    def _create_client(self) -> BackendClient:
        return BackendClient(
            StdioBackendTransport(
                command=self.command,
                timeout_seconds=self.timeout_seconds,
                env=self.env,
            )
        )

    def _run_with(self, client: BackendClient, payload: dict[str, Any], *, close_after: bool) -> dict[str, Any]:
        try:
            return client.run(payload)
        except BackendTransportError as exc:
            if not close_after:
                self.close()
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
            if close_after:
                client.close()
