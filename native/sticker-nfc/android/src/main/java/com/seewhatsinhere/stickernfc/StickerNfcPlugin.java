package com.seewhatsinhere.stickernfc;

import android.app.Activity;
import android.nfc.FormatException;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.nfc.tech.NdefFormatable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;

/**
 * Writes one URL record to an NFC sticker. Android has no system sheet for this, so the app
 * shows its own "hold a sticker to your phone" screen while reader mode is on.
 * Error codes match lib/stickerWriter.ts: unsupported, nfc_off, cancelled, locked, too_small, not_writable, failed.
 */
@CapacitorPlugin(name = "StickerNfc")
public class StickerNfcPlugin extends Plugin {

    private PluginCall pending;
    private NdefMessage message;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        JSObject result = new JSObject();
        result.put("available", adapter != null);
        result.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(result);
    }

    @PluginMethod
    public void writeUrl(PluginCall call) {
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        if (adapter == null) {
            call.reject("This phone can't write NFC stickers.", "unsupported");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("NFC is switched off.", "nfc_off");
            return;
        }
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Missing sticker link.", "failed");
            return;
        }
        finish(null, "Started another write.", "cancelled");
        pending = call;
        message = new NdefMessage(new NdefRecord[] { NdefRecord.createUri(url) });
        Activity activity = getActivity();
        int flags = NfcAdapter.FLAG_READER_NFC_A | NfcAdapter.FLAG_READER_NFC_B | NfcAdapter.FLAG_READER_NFC_F | NfcAdapter.FLAG_READER_NFC_V;
        activity.runOnUiThread(() -> adapter.enableReaderMode(activity, this::onTag, flags, null));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        finish(null, "Cancelled.", "cancelled");
        call.resolve();
    }

    @Override
    protected void handleOnPause() {
        finish(null, "Cancelled.", "cancelled");
        super.handleOnPause();
    }

    private void onTag(Tag tag) {
        NdefMessage msg = message;
        if (msg == null) return;
        try {
            Ndef ndef = Ndef.get(tag);
            if (ndef != null) {
                ndef.connect();
                try {
                    if (!ndef.isWritable()) {
                        finish(null, "This sticker is locked, so it can't be changed.", "locked");
                        return;
                    }
                    if (ndef.getMaxSize() < msg.toByteArray().length) {
                        finish(null, "This sticker is too small for the link.", "too_small");
                        return;
                    }
                    ndef.writeNdefMessage(msg);
                } finally {
                    ndef.close();
                }
            } else {
                NdefFormatable blank = NdefFormatable.get(tag);
                if (blank == null) {
                    finish(null, "This sticker can't hold a link.", "not_writable");
                    return;
                }
                blank.connect();
                try {
                    blank.format(msg);
                } finally {
                    blank.close();
                }
            }
            finish(new JSObject(), null, null);
        } catch (IOException | FormatException e) {
            finish(null, "That didn't write. Hold the sticker still and try again.", "failed");
        }
    }

    /** Settles the JavaScript call exactly once and turns reader mode off. */
    private synchronized void finish(JSObject result, String error, String code) {
        PluginCall call = pending;
        if (call == null && message == null) return;
        pending = null;
        message = null;
        Activity activity = getActivity();
        NfcAdapter adapter = NfcAdapter.getDefaultAdapter(getContext());
        if (activity != null && adapter != null) {
            activity.runOnUiThread(() -> {
                try {
                    adapter.disableReaderMode(activity);
                } catch (IllegalStateException ignored) {
                    // The activity is no longer in the foreground; reader mode is already off.
                }
            });
        }
        if (call == null) return;
        if (result != null) call.resolve(result);
        else call.reject(error, code);
    }
}
