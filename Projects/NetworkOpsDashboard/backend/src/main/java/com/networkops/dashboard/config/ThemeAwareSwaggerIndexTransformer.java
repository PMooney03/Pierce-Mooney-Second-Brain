package com.networkops.dashboard.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springdoc.core.properties.SwaggerUiConfigProperties;
import org.springdoc.core.properties.SwaggerUiOAuthProperties;
import org.springdoc.core.providers.ObjectMapperProvider;
import org.springdoc.webmvc.ui.SwaggerIndexPageTransformer;
import org.springdoc.webmvc.ui.SwaggerWelcomeCommon;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.resource.ResourceTransformerChain;
import org.springframework.web.servlet.resource.TransformedResource;
import jakarta.servlet.http.HttpServletRequest;

/**
 * Injects a dark/light theme stylesheet and toggle script into Swagger UI.
 */
public class ThemeAwareSwaggerIndexTransformer extends SwaggerIndexPageTransformer {

    private static final String THEME_INJECTION = """
            <link rel="stylesheet" type="text/css" href="/swagger-theme.css" />
            <script src="/swagger-theme.js" defer></script>
            </head>
            """;

    public ThemeAwareSwaggerIndexTransformer(
            SwaggerUiConfigProperties swaggerUiConfig,
            SwaggerUiOAuthProperties swaggerUiOAuthProperties,
            SwaggerWelcomeCommon swaggerWelcomeCommon,
            ObjectMapperProvider objectMapperProvider
    ) {
        super(swaggerUiConfig, swaggerUiOAuthProperties, swaggerWelcomeCommon, objectMapperProvider);
    }

    @Override
    public Resource transform(
            HttpServletRequest request,
            Resource resource,
            ResourceTransformerChain transformer
    ) throws IOException {
        Resource transformed = super.transform(request, resource, transformer);
        String filename = resource.getFilename();
        if (filename == null || !filename.endsWith("index.html")) {
            return transformed;
        }

        String html = new String(transformed.getContentAsByteArray(), StandardCharsets.UTF_8);
        if (html.contains("swagger-theme.css")) {
            return transformed;
        }

        String updated = html.replace("</head>", THEME_INJECTION);
        return new TransformedResource(resource, updated.getBytes(StandardCharsets.UTF_8));
    }
}
