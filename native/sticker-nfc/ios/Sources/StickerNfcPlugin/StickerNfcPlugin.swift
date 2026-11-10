import Foundation
import Capacitor
import CoreNFC

/// Writes one URL record to an NFC sticker using the iPhone's own "Ready to Scan" sheet.
/// Error codes match lib/stickerWriter.ts: unsupported, cancelled, locked, too_small, not_writable, failed.
@objc(StickerNfcPlugin)
public class StickerNfcPlugin: CAPPlugin, CAPBridgedPlugin, NFCNDEFReaderSessionDelegate {
    public let identifier = "StickerNfcPlugin"
    public let jsName = "StickerNfc"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "writeUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private var session: NFCNDEFReaderSession?
    private var pending: CAPPluginCall?
    private var message: NFCNDEFMessage?
    private var doneText = "Sticker written"

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": NFCNDEFReaderSession.readingAvailable])
    }

    @objc func writeUrl(_ call: CAPPluginCall) {
        guard NFCNDEFReaderSession.readingAvailable else {
            call.reject("This phone can't write NFC stickers.", "unsupported")
            return
        }
        guard let text = call.getString("url"), let url = URL(string: text),
              let record = NFCNDEFPayload.wellKnownTypeURIPayload(url: url) else {
            call.reject("Missing sticker link.", "failed")
            return
        }
        finish(error: ("Started another write.", "cancelled"))
        pending = call
        message = NFCNDEFMessage(records: [record])
        doneText = call.getString("doneMessage") ?? "Sticker written"
        let prompt = call.getString("prompt") ?? "Hold the top of your iPhone near the sticker."
        DispatchQueue.main.async {
            let session = NFCNDEFReaderSession(delegate: self, queue: nil, invalidateAfterFirstRead: false)
            session.alertMessage = prompt
            self.session = session
            session.begin()
        }
    }

    @objc func cancel(_ call: CAPPluginCall) {
        session?.invalidate()
        call.resolve()
    }

    // MARK: - NFCNDEFReaderSessionDelegate

    public func readerSession(_ session: NFCNDEFReaderSession, didDetectNDEFs messages: [NFCNDEFMessage]) {
        // Not used: didDetect tags below takes over, so we can write as well as read.
    }

    public func readerSession(_ session: NFCNDEFReaderSession, didDetect tags: [NFCNDEFTag]) {
        guard tags.count == 1, let tag = tags.first else {
            session.alertMessage = "More than one sticker found. Hold just one."
            DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(600)) { session.restartPolling() }
            return
        }
        session.connect(to: tag) { error in
            if error != nil {
                self.fail(session, "Couldn't reach the sticker. Try again.", "failed")
                return
            }
            tag.queryNDEFStatus { status, capacity, error in
                guard error == nil, let message = self.message else {
                    self.fail(session, "Couldn't read the sticker. Try again.", "failed")
                    return
                }
                switch status {
                case .notSupported:
                    self.fail(session, "This sticker can't hold a link.", "not_writable")
                case .readOnly:
                    self.fail(session, "This sticker is locked, so it can't be changed.", "locked")
                case .readWrite:
                    if message.length > capacity {
                        self.fail(session, "This sticker is too small for the link.", "too_small")
                        return
                    }
                    tag.writeNDEF(message) { error in
                        if error != nil {
                            self.fail(session, "That didn't write. Hold the sticker still and try again.", "failed")
                        } else {
                            session.alertMessage = self.doneText
                            self.finish(error: nil)
                            session.invalidate()
                        }
                    }
                @unknown default:
                    self.fail(session, "This sticker can't hold a link.", "not_writable")
                }
            }
        }
    }

    public func readerSession(_ session: NFCNDEFReaderSession, didInvalidateWithError error: Error) {
        if let nfc = error as? NFCReaderError, nfc.code == .readerSessionInvalidationErrorUserCanceled
            || nfc.code == .readerSessionInvalidationErrorSessionTimeout {
            finish(error: ("Cancelled.", "cancelled"))
        } else {
            finish(error: (error.localizedDescription, "failed"))
        }
        if self.session === session { self.session = nil }
    }

    // MARK: - Helpers

    private func fail(_ session: NFCNDEFReaderSession, _ text: String, _ code: String) {
        finish(error: (text, code))
        session.invalidate(errorMessage: text)
    }

    /// Settles the JavaScript call exactly once.
    private func finish(error: (String, String)?) {
        guard let call = pending else { return }
        pending = nil
        message = nil
        if let (text, code) = error {
            call.reject(text, code)
        } else {
            call.resolve()
        }
    }
}
