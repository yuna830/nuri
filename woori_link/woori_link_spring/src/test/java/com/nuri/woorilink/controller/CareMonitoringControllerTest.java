package com.nuri.woorilink.controller;

import com.nuri.woorilink.common.security.AuthenticatedUser;
import com.nuri.woorilink.entity.CareAlert;
import com.nuri.woorilink.service.CareMonitoringService;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CareMonitoringControllerTest {
    private final CareMonitoringService service = mock(CareMonitoringService.class);
    private final CareMonitoringController controller = new CareMonitoringController(service);

    @Test
    void guardianCanOnlyReadOwnAlerts() {
        var authentication = guardianAuthentication(7L);
        when(service.guardianAlerts(7L)).thenReturn(List.of());

        controller.guardianAlerts(7L, authentication);
        verify(service).guardianAlerts(7L);

        assertThrows(
                AccessDeniedException.class,
                () -> controller.guardianAlerts(8L, authentication)
        );
    }

    @Test
    void acknowledgeIsScopedToAuthenticatedGuardian() {
        var authentication = guardianAuthentication(7L);
        CareAlert alert = new CareAlert();
        when(service.acknowledgeAlert(11L, false, 7L)).thenReturn(alert);

        controller.acknowledge(
                11L,
                new CareMonitoringController.AlertStatusRequest(false),
                authentication
        );

        verify(service).acknowledgeAlert(11L, false, 7L);
    }

    private UsernamePasswordAuthenticationToken guardianAuthentication(Long guardianId) {
        return new UsernamePasswordAuthenticationToken(
                new AuthenticatedUser("01012345678", "GUARDIAN", guardianId),
                null,
                List.of()
        );
    }
}
