package com.nuri.woorilink.controller;

import com.nuri.woorilink.dto.AddressSearchResult;
import com.nuri.woorilink.service.KakaoAddressService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/addresses")
@RequiredArgsConstructor
public class AddressController {

    private final KakaoAddressService kakaoAddressService;

    @GetMapping("/search")
    public List<AddressSearchResult> search(@RequestParam String query) {
        return kakaoAddressService.search(query);
    }
}
