{{- define "tab-tutor.name" -}}tab-tutor{{- end -}}

{{- define "tab-tutor.labels" -}}
app.kubernetes.io/name: tab-tutor
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "tab-tutor.selectorLabels" -}}
app.kubernetes.io/name: tab-tutor
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
