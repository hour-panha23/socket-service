"use client";

import { logger } from "@/src/lib/logger";
import {
  createDevice,
  updateDevice,
} from "@/src/services/device/device.service";
import { CreateDevice, Device } from "@/src/services/device/device.types";
import { Cpu, Radio, Webhook, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import AlertDialog, { AlertDialogState } from "../AlertDialog";

interface DeviceModalProps {
  isOpen: boolean;
  device?: Device | null;
  onClose: () => void;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateDevice = {
  device_name: "",
  device_id: 0,
  device_serial: "",
  project_id: "",
  app_id: "",
  room: "",
  event: "",
  webhook: "",
};

export const DeviceModal: React.FC<DeviceModalProps> = ({
  isOpen,
  device,
  onClose,
  onSuccess,
}) => {
  const isEdit = Boolean(device?.id);

  const [formData, setFormData] = useState<CreateDevice>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [errorDialog, setErrorDialog] = useState<AlertDialogState | null>(null);

  useEffect(() => {
    if (device) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData({
        device_name: device.device_name || "",
        device_id: device.device_id || 0,
        device_serial: device.device_serial || "",
        project_id: device.project_id || "",
        app_id: device.app_id || "",
        room: device.room || "",
        event: device.event || "",
        webhook: device.webhook || "",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [device, isOpen]);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.device_name.trim()) {
      toast.error("Please enter device name");
      return;
    }

    setLoading(true);

    try {
      const res =
        isEdit && device
          ? await updateDevice(device.id.toString(), formData)
          : await createDevice(formData);

      if (res.status_code !== 200) {
        setErrorDialog({
          isOpen: true,
          title: "Error",
          variant: "error",
          description:
            res.message || `Failed to ${isEdit ? "update" : "create"} device`,
          confirmLabel: "OK",
          onConfirm: () => setErrorDialog(null),
        });
        return;
      }

      toast.success(`Device ${isEdit ? "updated" : "created"} successfully`);
      handleClose();
      onSuccess();
    } catch (err) {
      logger.error(err);
      setErrorDialog({
        isOpen: true,
        title: "Error",
        variant: "error",
        description:
          err instanceof Error ? err.message : "An unexpected error occurred",
        confirmLabel: "OK",
        onConfirm: () => setErrorDialog(null),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrorDialog(null);
    setFormData(EMPTY_FORM);
    onClose();
  };

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-slate-700/50 backdrop-blur-xs p-4">
      <div className="bg-slate-900 shadow-2xl border border-slate-700 rounded-2xl w-full max-w-4xl overflow-hidden animate-in duration-150 fade-in zoom-in-95">
        {/* Header */}
        <div className="flex justify-between items-center bg-slate-950/50 p-6 border-slate-700 border-b">
          <h2 className="flex items-center gap-2 font-bold text-white text-lg">
            <Cpu className="w-5 h-5 text-indigo-400" />
            {isEdit
              ? `Edit Device (${device?.device_name})`
              : "Register New Device"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="hover:bg-slate-800 p-1 rounded-lg text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="gap-4 grid grid-cols-1 sm:grid-cols-3">
            <div>
              <label className="block mb-1.5 font-semibold text-slate-200 text-xs">
                Device Name
              </label>
              <input
                type="text"
                name="device_name"
                required
                placeholder="e.g. Traffic Camera #1"
                value={formData.device_name}
                onChange={handleInputChange}
                className="bg-slate-950 p-2.5 border border-slate-700 focus:border-indigo-400 rounded-lg focus:outline-none w-full text-white text-sm"
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-slate-200 text-xs">
                Device ID (Numeric)
              </label>
              <input
                type="number"
                name="device_id"
                required
                placeholder="e.g. 1001"
                value={formData.device_id || ""}
                onChange={handleInputChange}
                className="bg-slate-950 p-2.5 border border-slate-700 focus:border-indigo-400 rounded-lg focus:outline-none w-full font-mono text-white text-sm"
              />
            </div>
            <div>
              <label className="block mb-1.5 font-semibold text-slate-200 text-xs">
                Device Serial (`device_serial`)
              </label>
              <input
                type="text"
                name="device_serial"
                required
                placeholder="e.g. SN-99882-Y"
                value={formData.device_serial}
                onChange={handleInputChange}
                className="bg-slate-950 p-2.5 border border-slate-700 focus:border-indigo-400 rounded-lg focus:outline-none w-full font-mono text-white text-sm"
              />
            </div>
          </div>

          {/* Socket Channel Group */}
          <div className="space-y-3 bg-slate-950/80 p-4 border border-indigo-500/40 rounded-xl">
            <div className="flex items-center gap-1.5 font-bold text-indigo-400 text-xs uppercase tracking-wider">
              <Radio className="w-4 h-4 text-indigo-400" /> Socket.io Config
            </div>
            <div className="gap-3 grid grid-cols-1 sm:grid-cols-3">
              <div>
                <label className="block mb-1 text-slate-300 text-xs">
                  Project ID
                </label>
                <input
                  type="text"
                  name="project_id"
                  required
                  placeholder="proj_smart_city"
                  value={formData.project_id}
                  onChange={handleInputChange}
                  className="bg-slate-900 p-2 border border-slate-700 focus:border-indigo-400 rounded-lg w-full font-mono text-white text-sm"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-300 text-xs">
                  App ID
                </label>
                <input
                  type="text"
                  name="app_id"
                  required
                  placeholder="app_traffic"
                  value={formData.app_id}
                  onChange={handleInputChange}
                  className="bg-slate-900 p-2 border border-slate-700 focus:border-indigo-400 rounded-lg w-full font-mono text-white text-sm"
                />
              </div>
              <div>
                <label className="block mb-1 text-slate-300 text-xs">
                  Room
                </label>
                <input
                  type="text"
                  name="room"
                  required
                  placeholder="zone_north"
                  value={formData.room}
                  onChange={handleInputChange}
                  className="bg-slate-900 p-2 border border-slate-700 focus:border-indigo-400 rounded-lg w-full font-mono text-white text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-slate-300 text-xs">
                Event Name
              </label>
              <input
                type="text"
                name="event"
                required
                placeholder="e.g. telemetry_update"
                value={formData.event}
                onChange={handleInputChange}
                className="bg-slate-900 p-2 border border-slate-700 focus:border-indigo-400 rounded-lg w-full font-mono text-white text-sm"
              />
            </div>
          </div>

          {/* Webhook Endpoint */}
          <div>
            <label className="flex items-center gap-1 mb-1.5 font-semibold text-slate-200 text-xs">
              <Webhook className="w-4 h-4 text-amber-400" />
              Webhook URL (`webhook`)
            </label>
            <input
              type="text"
              name="webhook"
              required
              placeholder="https://backend.domain.com/api/v1/webhooks/socket"
              value={formData.webhook}
              onChange={handleInputChange}
              className="bg-slate-950 p-2.5 border border-slate-700 focus:border-indigo-400 rounded-lg w-full font-mono text-white text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-slate-700 border-t">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 font-medium text-slate-300 hover:text-white text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 border border-indigo-400/30 rounded-lg font-semibold text-white text-sm transition"
            >
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                  ? "Save Changes"
                  : "Register Device"}
            </button>
          </div>
        </form>
      </div>

      <AlertDialog
        isOpen={errorDialog?.isOpen || false}
        variant={errorDialog?.variant || "error"}
        title={errorDialog?.title || ""}
        description={errorDialog?.description || ""}
        showCancelButton={false}
        confirmLabel={errorDialog?.confirmLabel || "OK"}
        onConfirm={() => setErrorDialog(null)}
        onClose={() => setErrorDialog(null)}
      />
    </div>
  );
};
