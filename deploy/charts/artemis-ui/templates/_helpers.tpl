{{- define "artemis-ui.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "artemis-ui.fullname" -}}
{{- printf "%s-%s" .Release.Name (include "artemis-ui.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "artemis-ui.labels" -}}
app.kubernetes.io/name: {{ include "artemis-ui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "artemis-ui.selectorLabels" -}}
app.kubernetes.io/name: {{ include "artemis-ui.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
