"use client";

import {
  deleteDevice,
  listDevices,
} from "@/src/services/device/device.service";
import { Device } from "@/src/services/device/device.types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Cpu,
  Edit3,
  ExternalLink,
  Loader2,
  Plus,
  Radio,
  Search,
  Trash2,
  Webhook,
} from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import AlertDialog from "../AlertDialog";
import { DeviceModal } from "./DeviceModal";

export const DeviceManagement: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  // Delete Alert State
  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean;
    device: Device | null;
  }>({
    isOpen: false,
    device: null,
  });

  // Fetch List Query
  const {
    data: deviceResponse,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ["list-device", { searchTerm, page, limit }],
    queryFn: async () => {
      const response = await listDevices({
        search: searchTerm || undefined,
        page,
        limit,
      });

      return {
        data: (response?.data?.data as Device[]) || [],
        total: response?.data?.total || 0,
        total_page: response?.data?.total_page || 1,
      };
    },
    placeholderData: (previousData) => previousData,
  });

  const deviceList = deviceResponse?.data || [];

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDevice(id),
    onSuccess: () => {
      toast.success("Device deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["list-device"] });
      setDeleteDialog({ isOpen: false, device: null });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete device");
    },
  });

  const handleOpenCreateModal = () => {
    setSelectedDevice(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (device: Device) => {
    setSelectedDevice(device);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteDialog.device) {
      deleteMutation.mutate(deleteDialog.device.id);
    }
  };

  return (
    <div className="bg-slate-950 px-8 py-2 w-full min-h-screen font-sans text-slate-100">
      <div className="space-y-6 mx-auto">
        {/* Header */}
        <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-4 pb-6 border-slate-800 border-b">
          <div>
            <h1 className="flex items-center gap-2.5 font-bold text-white text-2xl tracking-wide">
              <Cpu className="w-7 h-7 text-indigo-400" />
              Device Management
            </h1>
          </div>
          <button
            onClick={handleOpenCreateModal}
            className="flex justify-center items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 shadow-indigo-600/30 shadow-md px-4 py-2.5 border border-indigo-400/30 rounded-lg font-semibold text-white transition duration-200"
          >
            <Plus className="w-4 h-4" />
            Add New Device
          </button>
        </div>

        {/* Toolbar Search */}
        <div className="flex items-center gap-4 bg-slate-900 shadow-md p-4 border border-slate-700/80 rounded-xl">
          <div className="relative flex-1">
            <Search className="top-1/2 left-3.5 absolute w-4 h-4 text-slate-300 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by Device Name, ID, Serial, Project, App, or Room..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 py-2.5 pr-4 pl-10 border border-slate-700 focus:border-indigo-400 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 w-full text-white text-sm transition placeholder-slate-400"
            />
          </div>
        </div>

        {/* Devices Table */}
        <div className="bg-slate-900 shadow-xl border border-slate-700/80 rounded-xl overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-950/80 border-slate-700 border-b font-mono text-slate-200 text-xs uppercase tracking-wider">
              <tr>
                <th className="p-4">Device Identity</th>
                <th className="p-4">Socket Target (Project / App / Room)</th>
                <th className="p-4">Socket Event</th>
                <th className="p-4">Webhook Endpoint</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-slate-400 text-center">
                    <div className="flex justify-center items-center gap-2 font-mono text-xs">
                      <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />
                      Loading devices...
                    </div>
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 font-mono text-rose-400 text-xs text-center"
                  >
                    Failed to load devices:{" "}
                    {(error as Error)?.message || "Unknown error"}
                  </td>
                </tr>
              ) : deviceList.length > 0 ? (
                deviceList.map((device) => (
                  <tr
                    key={device.id}
                    className="hover:bg-slate-800/60 transition"
                  >
                    <td className="p-4">
                      <div className="font-mono font-bold text-white text-base">
                        {device.device_name}
                      </div>
                      <div className="mt-0.5 font-mono text-slate-300 text-xs">
                        ID:{" "}
                        <span className="text-slate-100">
                          {device.device_id}
                        </span>{" "}
                        | SN:{" "}
                        <span className="text-slate-100">
                          {device.device_serial}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 font-mono font-semibold text-indigo-300 text-xs">
                        <Radio className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{device.project_id}</span> /{" "}
                        <span>{device.app_id}</span>
                      </div>
                      <div className="mt-1 font-mono text-slate-300 text-xs">
                        Room:{" "}
                        <span className="font-semibold text-white">
                          {device.room}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="inline-block bg-emerald-950/80 shadow-sm px-2.5 py-1 border border-emerald-500/50 rounded-md font-mono font-semibold text-emerald-300 text-xs">
                        {device.event}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 max-w-xs font-mono text-slate-200 text-xs truncate">
                        <Webhook className="w-4 h-4 text-amber-400 shrink-0" />
                        <a
                          href={device.webhook}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-slate-100 hover:text-indigo-300 hover:underline truncate"
                          title={device.webhook}
                        >
                          {device.webhook}
                          <ExternalLink className="opacity-80 w-3 h-3 shrink-0" />
                        </a>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(device)}
                          className="hover:bg-slate-800 p-2 border border-transparent hover:border-slate-700 rounded-lg text-slate-300 hover:text-white transition"
                          title="Edit Device"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() =>
                            setDeleteDialog({ isOpen: true, device })
                          }
                          className="hover:bg-rose-950/50 p-2 border border-transparent hover:border-rose-800/50 rounded-lg text-slate-300 hover:text-rose-400 transition"
                          title="Delete Device"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : deviceList.length > 0 ? (
                deviceList.map((device) => (
                  <tr
                    key={device.id}
                    className="hover:bg-slate-800/60 transition"
                  >
                    {/* Table row content */}
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 font-mono text-slate-400 text-xs text-center"
                  >
                    {searchTerm.trim() !== ""
                      ? "No devices match your search query."
                      : "No devices found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal */}
        <DeviceModal
          isOpen={isModalOpen}
          device={selectedDevice}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["list-device"] });
            setIsModalOpen(false);
          }}
        />

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog
          isOpen={deleteDialog.isOpen}
          variant="error"
          title="Delete Device Target"
          description={
            <span>
              Are you sure you want to delete{" "}
              <strong className="font-bold text-white">
                &quot;{deleteDialog.device?.device_name}&quot;
              </strong>
              ? This action cannot be undone.
            </span>
          }
          confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete"}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteDialog({ isOpen: false, device: null })}
        />
      </div>
    </div>
  );
};

export default DeviceManagement;
