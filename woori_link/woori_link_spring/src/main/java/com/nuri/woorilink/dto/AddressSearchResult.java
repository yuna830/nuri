package com.nuri.woorilink.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class AddressSearchResult {
    private String address;
    private String roadAddress;
    private String jibunAddress;
    private Double latitude;
    private Double longitude;
}
