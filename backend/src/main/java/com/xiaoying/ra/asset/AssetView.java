package com.xiaoying.ra.asset;

public record AssetView(Long id, String originalName, String mimeType, long sizeBytes, String url) {
    public static AssetView of(Asset asset) {
        return new AssetView(asset.getId(), asset.getOriginalName(), asset.getMimeType(),
                asset.getSizeBytes(), "/files/" + asset.getStoredPath());
    }
}
