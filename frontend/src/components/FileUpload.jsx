import React, { useState, useEffect, useCallback } from 'react';
import { Upload, FileText, Trash2, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '../services/api';

const FileUpload = () => {
    const [files, setFiles] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState(null);
    const [dragActive, setDragActive] = useState(false);

    const fetchFiles = useCallback(async () => {
        try {
            const res = await api.get('/admin/uploads');
            setFiles(res.data.files || []);
        } catch {
            /* silently fail on load */
        }
    }, []);

    useEffect(() => { fetchFiles(); }, [fetchFiles]);

    const handleUpload = async (fileList) => {
        if (!fileList?.length) return;
        const file = fileList[0];

        const allowed = ['.pdf', '.docx', '.txt'];
        const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!allowed.includes(ext)) {
            setUploadStatus({ type: 'error', message: `Unsupported file type. Allowed: ${allowed.join(', ')}` });
            return;
        }

        setUploading(true);
        setUploadStatus(null);

        const form = new FormData();
        form.append('file', file);

        try {
            const res = await api.post('/admin/upload', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setUploadStatus({ type: 'success', message: `${file.name} indexed (${res.data.chunks_indexed} chunks)` });
            fetchFiles();
        } catch (err) {
            setUploadStatus({ type: 'error', message: err?.response?.data?.detail || 'Upload failed' });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (fileId) => {
        try {
            await api.delete(`/admin/uploads/${fileId}`);
            setFiles((prev) => prev.filter((f) => f.file_id !== fileId));
            setUploadStatus({ type: 'success', message: 'File deleted' });
        } catch {
            setUploadStatus({ type: 'error', message: 'Delete failed' });
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(e.type === 'dragenter' || e.type === 'dragover');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleUpload(e.dataTransfer.files);
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
            <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Knowledge Base</h2>
                <p className="text-sm text-zinc-400 mt-1">Upload documents to expand the persona's knowledge.</p>
            </div>

            {/* Drop zone */}
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer ${
                    dragActive
                        ? 'border-blue-500 bg-blue-500/5'
                        : 'border-white/[0.07] bg-white/[0.02] hover:border-blue-500/40'
                }`}
                onClick={() => document.getElementById('file-input').click()}
            >
                <input
                    id="file-input"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files)}
                />
                {uploading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                        <p className="text-sm text-zinc-300 font-medium">Processing document...</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <Upload className="w-10 h-10 text-zinc-500" />
                        <p className="text-sm text-zinc-300 font-medium">Drop a file here or click to upload</p>
                        <p className="text-xs text-zinc-500">Supports PDF, DOCX, TXT</p>
                    </div>
                )}
            </div>

            {/* Status message */}
            {uploadStatus && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border ${
                    uploadStatus.type === 'success'
                        ? 'text-green-200 bg-green-500/10 border-green-500/30'
                        : 'text-red-200 bg-red-500/10 border-red-500/30'
                }`}>
                    {uploadStatus.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                    {uploadStatus.message}
                </div>
            )}

            {/* Uploaded files list */}
            <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">Uploaded Documents</h3>
                {files.length === 0 ? (
                    <p className="text-sm text-zinc-600 py-4">No documents uploaded yet.</p>
                ) : (
                    files.map((f) => (
                        <div
                            key={f.file_id}
                            className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/[0.07] rounded-xl hover:border-white/[0.12] transition-all"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <FileText className="w-5 h-5 text-blue-400 flex-shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm text-white font-medium truncate">{f.filename}</p>
                                    <p className="text-[10px] text-zinc-500">
                                        {(f.size_bytes / 1024).toFixed(1)} KB • {new Date(f.uploaded_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => handleDelete(f.file_id)}
                                className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                                title="Delete"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default FileUpload;
